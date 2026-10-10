import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : /\.tsx?$/.test(path) && !/\.(test|stories)\./.test(path)
        ? [path]
        : [];
  });
}

const files = sourceFiles(join(process.cwd(), 'src'));

function label(path: string) {
  return relative(process.cwd(), path).replaceAll('\\', '/');
}

function inspect(path: string, visit: (node: ts.Node) => void) {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const walk = (node: ts.Node) => {
    visit(node);
    ts.forEachChild(node, walk);
  };
  walk(source);
}

function resolveLocalModule(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith('@/')) {
    return join(process.cwd(), 'src', specifier.slice(2)).replaceAll('\\', '/');
  }
  if (specifier.startsWith('.')) {
    return join(dirname(fromFile), specifier).replaceAll('\\', '/');
  }
  return null;
}

interface ImportInfo {
  module: string;
  resolved: string | null;
  names: string[];
  isTypeOnly: boolean;
}

function getImportsAndExports(path: string): ImportInfo[] {
  const result: ImportInfo[] = [];
  inspect(path, (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      const bindings = node.importClause?.namedBindings;
      const isTypeOnly = Boolean(node.importClause?.isTypeOnly) || Boolean(
        !node.importClause?.name && bindings && ts.isNamedImports(bindings) &&
        bindings.elements.length > 0 && bindings.elements.every((binding) => binding.isTypeOnly),
      );
      const names = bindings && ts.isNamedImports(bindings)
        ? bindings.elements.filter((binding) => !binding.isTypeOnly).map((binding) => binding.propertyName?.text ?? binding.name.text)
        : [];
      result.push({
        module: specifier,
        resolved: resolveLocalModule(path, specifier),
        names,
        isTypeOnly,
      });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      result.push({
        module: specifier,
        resolved: resolveLocalModule(path, specifier),
        names: [],
        isTypeOnly: Boolean(node.isTypeOnly),
      });
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const specifier = node.arguments[0].text;
      result.push({
        module: specifier,
        resolved: resolveLocalModule(path, specifier),
        names: [],
        isTypeOnly: false,
      });
    }
  });
  return result;
}

function getLayer(relPath: string): { layer: string; feature?: string } {
  const norm = relPath.replace(/^src\//, '');
  const parts = norm.split('/');
  const top = parts[0];
  if (top === 'features') {
    return { layer: 'feature', feature: parts[1] };
  }
  return { layer: top };
}

const ALLOWED_FEATURE_DEPS: Record<string, string[]> = {
  sudoku: [],
  stages: ['sudoku'],
  endless: ['sudoku'],
  ranking: ['account'],
  account: [],
  home: ['account', 'endless', 'ranking', 'stages'],
};

describe('책임 경계와 기능 패키지 아키텍처', () => {
  it('레거시 src/game, src/screens, src/api 생산 모듈이 존재하지 않는다', () => {
    const legacyFiles = files
      .map(label)
      .filter((file) => /^src\/(game|screens|api)\//.test(file));
    expect(legacyFiles).toEqual([]);
  });

  it('기능 간 허용된 비순환 의존성만 존재하며 상위/하위 계층 규칙을 준수한다', () => {
    const failures: string[] = [];
    for (const file of files) {
      const fromLabel = label(file);
      const fromLayer = getLayer(fromLabel);
      const deps = getImportsAndExports(file);

      for (const dep of deps) {
        if (!dep.resolved) continue;
        const toLabel = relative(process.cwd(), dep.resolved).replaceAll('\\', '/');
        if (!toLabel.startsWith('src/')) continue;
        const toLayer = getLayer(toLabel);

        // Generic platform/ui/shared cannot import features or application
        if (['platform', 'ui', 'shared'].includes(fromLayer.layer)) {
          if (toLayer.layer === 'feature' || toLayer.layer === 'application') {
            failures.push(`${fromLabel} -> ${toLabel}: ${fromLayer.layer}는 feature/application을 참조할 수 없다`);
          }
        }

        // Feature cannot import application or server
        if (fromLayer.layer === 'feature') {
          if (toLayer.layer === 'application') {
            failures.push(`${fromLabel} -> ${toLabel}: feature는 application을 참조할 수 없다`);
          }
          if (toLayer.layer === 'server') {
            failures.push(`${fromLabel} -> ${toLabel}: feature는 server를 참조할 수 없다`);
          }
        }

        // Feature-to-feature dependencies (type references included)
        if (fromLayer.layer === 'feature' && toLayer.layer === 'feature') {
          if (fromLayer.feature !== toLayer.feature) {
            const allowed = ALLOWED_FEATURE_DEPS[fromLayer.feature ?? ''] ?? [];
            if (!allowed.includes(toLayer.feature ?? '')) {
              failures.push(
                `${fromLabel} -> ${toLabel}: 허용되지 않은 기능 의존성 (${fromLayer.feature} -> ${toLayer.feature})`,
              );
            }
          }
        }

        // Server cannot import features (except side-effect-free domain validation), application, ui, platform
        if (fromLayer.layer === 'server') {
          if (['application', 'ui', 'platform'].includes(toLayer.layer)) {
            failures.push(`${fromLabel} -> ${toLabel}: server는 ${toLayer.layer}를 참조할 수 없다`);
          }
          if (toLayer.layer === 'feature' && !toLabel.endsWith('nickname')) {
            failures.push(`${fromLabel} -> ${toLabel}: server는 도메인 검증 외의 feature를 참조할 수 없다`);
          }
        }

        // Client layers cannot import server
        if (['ui', 'platform', 'shared', 'application'].includes(fromLayer.layer)) {
          if (toLayer.layer === 'server') {
            failures.push(`${fromLabel} -> ${toLabel}: ${fromLayer.layer}는 server를 참조할 수 없다`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('View는 상태·생명주기와 입출력 구현을 직접 소유하지 않는다', () => {
    const failures: string[] = [];
    const views = files.filter(
      (path) =>
        path.endsWith('.tsx') &&
        !/[/\\]use[^/\\]*\.tsx$/.test(path) &&
        !/[/\\](queryClient|ErrorBoundary)\.tsx$/.test(path),
    );
    for (const path of views) {
      for (const dep of getImportsAndExports(path)) {
        if (dep.isTypeOnly) continue;
        if (
          dep.module === 'react' &&
          dep.names.some((name) => /^(useState|useReducer|useRef|useEffect|useLayoutEffect)$/.test(name))
        ) {
          failures.push(`${label(path)}: 상태·생명주기 직접 소유`);
        }
        if (
          /\/api\/|\/server\/|\/(sound|save|endlessMirror|sync)$|platform\/(audio\/sound|storage\/save)|(mirrorApi|stagesApi|accountApi|adminApi|endlessApi|localAuth|saveApi)$/.test(
            dep.module,
          )
        ) {
          failures.push(`${label(path)}: 구현 모듈 ${dep.module} 직접 참조`);
        }
      }
      inspect(path, (node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'fetch') {
          failures.push(`${label(path)}: HTTP 직접 호출`);
        }
        if (ts.isIdentifier(node) && ['localStorage', 'sessionStorage'].includes(node.text)) {
          failures.push(`${label(path)}: 저장소 직접 접근`);
        }
      });
    }
    expect(failures).toEqual([]);
  });

  it('Service는 HTTP와 로컬 저장 엔진을 직접 호출하지 않는다', () => {
    const failures: string[] = [];
    for (const path of files.filter((file) => /[/\\]use[^/\\]*\.tsx?$/.test(file))) {
      inspect(path, (node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'fetch') {
          failures.push(`${label(path)}: HTTP 직접 호출`);
        }
        if (ts.isIdentifier(node) && ['localStorage', 'sessionStorage'].includes(node.text)) {
          failures.push(`${label(path)}: 저장 엔진 직접 접근`);
        }
      });
    }
    expect(failures).toEqual([]);
  });

  it('클라이언트 코드와 API는 서버 SDK 및 React 책임을 넘지 않는다', () => {
    const failures: string[] = [];
    for (const path of files) {
      const name = label(path);
      for (const dep of getImportsAndExports(path)) {
        if (dep.isTypeOnly) continue;
        if (!name.startsWith('src/server/') && /^(?:@supabase\/|@prisma\/|.*generated\/prisma)/.test(dep.module)) {
          failures.push(`${name}: 서버 SDK 직접 참조`);
        }
        if ((name.startsWith('src/api/') || /(Api|sync|localAuth)\.ts$/.test(name)) && /^(react|react-dom)$/.test(dep.module)) {
          failures.push(`${name}: API에서 React 참조`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('순수 Logic은 환경과 입출력 구현에 의존하지 않는다', () => {
    const failures: string[] = [];
    const logic = files.filter((path) => {
      const name = label(path);
      return (
        name.startsWith('src/shared/') ||
        name.startsWith('src/features/sudoku/model/') ||
        /\/(selectionLogic|catalog|homeLogic|rankLogic|nickname|validation)\.ts$/.test(name) ||
        /\/(appLogic|gameTransition|forms|screenModels|boardProjection|stageCatalog|rules|tap|probe|path|solver|shape|logic|nickname)\.ts$/.test(
          name,
        )
      );
    });
    for (const path of logic) {
      for (const dep of getImportsAndExports(path)) {
        if (dep.isTypeOnly) continue;
        if (
          /^(react|react-dom|howler)$/.test(dep.module) ||
          /\/(api|server)\/|\/(sound|save|sync|endlessMirror|mirrorApi|accountApi|stagesApi|adminApi|localAuth|saveApi)$/.test(
            dep.module,
          ) ||
          /platform\//.test(dep.module)
        ) {
          failures.push(`${label(path)}: 부수 효과 모듈 ${dep.module} 참조`);
        }
      }
      inspect(path, (node) => {
        if (
          ts.isIdentifier(node) &&
          ['window', 'document', 'localStorage', 'sessionStorage', 'fetch', 'setTimeout', 'setInterval'].includes(
            node.text,
          )
        ) {
          failures.push(`${label(path)}: 환경 접근 ${node.text}`);
        }
      });
    }
    expect(failures).toEqual([]);
  });
});
