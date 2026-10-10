import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.tsx?$/.test(path) && !/\.(test|stories)\./.test(path) ? [path] : [];
  });
}

const files = sourceFiles(join(process.cwd(), 'src'));
function inspect(path: string, visit: (node: ts.Node) => void) {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, path.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const walk = (node: ts.Node) => { visit(node); ts.forEachChild(node, walk); };
  walk(source);
}

function label(path: string) { return relative(process.cwd(), path).replaceAll('\\', '/'); }
function imports(path: string) {
  const result: { module: string; names: string[] }[] = [];
  inspect(path, (node) => {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) || node.importClause?.isTypeOnly) return;
    const bindings = node.importClause?.namedBindings;
    const names = bindings && ts.isNamedImports(bindings) ? bindings.elements.filter((binding) => !binding.isTypeOnly).map((binding) => binding.propertyName?.text ?? binding.name.text) : [];
    result.push({ module: node.moduleSpecifier.text, names });
  });
  return result;
}

describe('책임 경계', () => {
  it('View는 상태·생명주기와 입출력 구현을 직접 소유하지 않는다', () => {
    const failures: string[] = [];
    const views = files.filter((path) => path.endsWith('.tsx') && !/[/\\]use[^/\\]*\.tsx$/.test(path) && !/[/\\](queryClient|ErrorBoundary)\.tsx$/.test(path));
    for (const path of views) {
      for (const dep of imports(path)) {
        if (dep.module === 'react' && dep.names.some((name) => /^(useState|useReducer|useRef|useEffect|useLayoutEffect)$/.test(name))) failures.push(`${label(path)}: 상태·생명주기 직접 소유`);
        if (/\/api\/|\/server\/|\/(sound|save|endlessMirror|sync)$/.test(dep.module)) failures.push(`${label(path)}: 구현 모듈 ${dep.module} 직접 참조`);
      }
      inspect(path, (node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'fetch') failures.push(`${label(path)}: HTTP 직접 호출`);
        if (ts.isIdentifier(node) && ['localStorage', 'sessionStorage'].includes(node.text)) failures.push(`${label(path)}: 저장소 직접 접근`);
      });
    }
    expect(failures).toEqual([]);
  });

  it('Service는 HTTP와 로컬 저장 엔진을 직접 호출하지 않는다', () => {
    const failures: string[] = [];
    for (const path of files.filter((file) => /[/\\]use[^/\\]*\.tsx?$/.test(file))) {
      inspect(path, (node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'fetch') failures.push(`${label(path)}: HTTP 직접 호출`);
        if (ts.isIdentifier(node) && ['localStorage', 'sessionStorage'].includes(node.text)) failures.push(`${label(path)}: 저장 엔진 직접 접근`);
      });
    }
    expect(failures).toEqual([]);
  });

  it('클라이언트 코드와 API는 서버 SDK 및 React 책임을 넘지 않는다', () => {
    const failures: string[] = [];
    for (const path of files) {
      const name = label(path);
      for (const dep of imports(path)) {
        if (!name.startsWith('src/server/') && /^(?:@supabase\/|@prisma\/|.*generated\/prisma)/.test(dep.module)) failures.push(`${name}: 서버 SDK 직접 참조`);
        if (name.startsWith('src/api/') && /^(react|react-dom)$/.test(dep.module)) failures.push(`${name}: API에서 React 참조`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('순수 Logic은 환경과 입출력 구현에 의존하지 않는다', () => {
    const failures: string[] = [];
    const logic = files.filter((path) => {
      const name = label(path);
      return name.startsWith('src/shared/') || /\/(appLogic|gameTransition|forms|screenModels|boardProjection|stageCatalog|rules|tap|probe|path|solver|shape|logic|nickname)\.ts$/.test(name);
    });
    for (const path of logic) {
      for (const dep of imports(path)) {
        if (/^(react|react-dom|howler)$/.test(dep.module) || /\/(api|server)\/|\/(sound|save|sync|endlessMirror)$/.test(dep.module)) failures.push(`${label(path)}: 부수 효과 모듈 ${dep.module} 참조`);
      }
      inspect(path, (node) => {
        if (ts.isIdentifier(node) && ['window', 'document', 'localStorage', 'sessionStorage', 'fetch', 'setTimeout', 'setInterval'].includes(node.text)) failures.push(`${label(path)}: 환경 접근 ${node.text}`);
      });
    }
    expect(failures).toEqual([]);
  });
});
