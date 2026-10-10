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

const sourceCache = new Map<string, ts.SourceFile>();

function getSourceFile(path: string): ts.SourceFile {
  let source = sourceCache.get(path);
  if (!source) {
    source = ts.createSourceFile(
      path,
      readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      path.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    sourceCache.set(path, source);
  }
  return source;
}

function inspect(path: string, visit: (node: ts.Node) => void, sourceOverride?: ts.SourceFile) {
  const source = sourceOverride ?? getSourceFile(path);
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
  isReExport?: boolean;
}

const importInfoCache = new Map<string, ImportInfo[]>();

function getImportsAndExports(path: string, sourceOverride?: ts.SourceFile): ImportInfo[] {
  const cached = sourceOverride ? undefined : importInfoCache.get(path);
  if (cached) return cached;
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
        names: node.exportClause && ts.isNamedExports(node.exportClause)
          ? node.exportClause.elements.map((binding) => binding.propertyName?.text ?? binding.name.text)
          : [],
        isTypeOnly: Boolean(node.isTypeOnly),
        isReExport: true,
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
    } else if (ts.isImportTypeNode(node)) {
      let specifier: string | null = null;
      if (ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
        specifier = node.argument.literal.text;
      } else if (ts.isStringLiteral(node.argument as unknown as ts.Node)) {
        specifier = (node.argument as unknown as ts.StringLiteral).text;
      }
      if (specifier) {
        result.push({
          module: specifier,
          resolved: resolveLocalModule(path, specifier),
          names: [],
          isTypeOnly: true,
        });
      }
    }
  }, sourceOverride);
  if (!sourceOverride) importInfoCache.set(path, result);
  return result;
}

function getLayer(relPath: string): { layer: string; feature?: string } {
  const norm = relPath.replace(/^src\//, '');
  const parts = norm.split('/');
  const top = parts[0];
  if (top === 'features') {
    return { layer: 'feature', feature: parts[1] };
  }
  if (top === 'views') {
    return { layer: 'views', feature: parts[1] };
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

function viewFailures(path: string, sourceOverride?: ts.SourceFile): string[] {
  const failures: string[] = [];
  for (const dep of getImportsAndExports(path, sourceOverride)) {
    if (dep.isTypeOnly) continue;
    if (
      dep.module === 'react' &&
      dep.names.some((name) => /^(useState|useReducer|useRef|useEffect|useLayoutEffect|useMemo|useCallback|useSyncExternalStore)$/.test(name))
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
    const forwardsConstants = dep.isReExport && dep.names.length > 0 &&
      dep.names.every((name) => /^[A-Z][A-Z0-9_]*$/.test(name));
    if (dep.resolved && !forwardsConstants) {
      const norm = dep.resolved.replace(/\.(tsx?|jsx?)$/, '');
      if (
        /(?:^|\/)(?:[^/]*Logic|boardProjection|screenModels|rules|tap|probe|path|solver|shape|catalog|classNames|confettiModel|validation|nickname)$/.test(norm) ||
        /\/features\/[^/]+\/model\//.test(norm)
      ) {
        failures.push(`${label(path)}: View에서 순수 모델 직접 참조 (${dep.module})`);
      }
    }
  }
  inspect(path, (node) => {
    if (ts.isCallExpression(node)) {
      // React hook calls: useState(...) or React.useState(...) or alias
      const expr = node.expression;
      if (ts.isIdentifier(expr) && /^(useState|useReducer|useRef|useEffect|useLayoutEffect|useMemo|useCallback|useSyncExternalStore)$/.test(expr.text)) {
        failures.push(`${label(path)}: 상태·생명주기 직접 소유 (${expr.text})`);
      } else if (
        ts.isPropertyAccessExpression(expr) &&
        ts.isIdentifier(expr.name) &&
        /^(useState|useReducer|useRef|useEffect|useLayoutEffect|useMemo|useCallback|useSyncExternalStore)$/.test(expr.name.text)
      ) {
        failures.push(`${label(path)}: 상태·생명주기 직접 소유 (${expr.name.text})`);
      }
      if (ts.isIdentifier(expr) && expr.text === 'fetch') {
        failures.push(`${label(path)}: HTTP 직접 호출`);
      }
      if (
        ts.isPropertyAccessExpression(expr) &&
        ts.isIdentifier(expr.expression) &&
        expr.expression.text === 'Array' &&
        expr.name.text === 'from'
      ) {
        failures.push(`${label(path)}: View에서 Array.from 직접 계산`);
      }
    }
    if (ts.isIdentifier(node) && ['localStorage', 'sessionStorage'].includes(node.text)) {
      failures.push(`${label(path)}: 저장소 직접 접근`);
    }
    // Arithmetic expressions +, -, *, /, %, **, ++, --
    const isArithmeticBinary =
      ts.isBinaryExpression(node) &&
      [
        ts.SyntaxKind.PlusToken,
        ts.SyntaxKind.MinusToken,
        ts.SyntaxKind.AsteriskToken,
        ts.SyntaxKind.SlashToken,
        ts.SyntaxKind.PercentToken,
        ts.SyntaxKind.AsteriskAsteriskToken,
      ].includes(node.operatorToken.kind);
    const isArithmeticUnary =
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator);

    if (isArithmeticBinary || isArithmeticUnary) {
      // Check if parent or ancestor is JSX attribute named 'key'
      let current: ts.Node = node;
      let inKeyAttribute = false;
      while (current.parent) {
        current = current.parent;
        if (ts.isJsxAttribute(current) && ts.isIdentifier(current.name) && current.name.text === 'key') {
          inKeyAttribute = true;
          break;
        }
      }
      if (!inKeyAttribute) {
        // String concatenation with '+' where one side is string literal is allowed
        const isStringConcat =
          ts.isBinaryExpression(node) &&
          node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
          (ts.isStringLiteral(node.left) || ts.isStringLiteral(node.right));
        if (!isStringConcat) {
          failures.push(`${label(path)}: View에서 산술 연산 직접 수행`);
        }
      }
    }
  }, sourceOverride);
  return failures;
}

describe('책임 경계와 기능 패키지 아키텍처', () => {
  it('레거시 src/game, src/screens, src/api 생산 모듈이 존재하지 않는다', () => {
    const legacyFiles = files
      .map(label)
      .filter((file) => /^src\/(game|screens|api)\//.test(file));
    expect(legacyFiles).toEqual([]);
  });

  it('features에 제품 TSX가 존재하지 않는다', () => {
    const featureTsx = files
      .map(label)
      .filter((file) => /^src\/features\/.*\.tsx$/.test(file));
    expect(featureTsx).toEqual([]);
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

        // Generic platform/ui/shared cannot import views, features or application
        if (['platform', 'ui', 'shared'].includes(fromLayer.layer)) {
          if (toLayer.layer === 'views' || toLayer.layer === 'feature' || toLayer.layer === 'application') {
            failures.push(`${fromLabel} -> ${toLabel}: ${fromLayer.layer}는 views/features/application을 참조할 수 없다`);
          }
        }

        // Feature cannot import views, application or server
        if (fromLayer.layer === 'feature') {
          if (toLayer.layer === 'views') {
            failures.push(`${fromLabel} -> ${toLabel}: feature는 views를 참조할 수 없다`);
          }
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

        // Views cannot import server, platform, application or direct API
        if (fromLayer.layer === 'views') {
          if (toLayer.layer === 'server') {
            failures.push(`${fromLabel} -> ${toLabel}: views는 server를 참조할 수 없다`);
          }
          if (toLayer.layer === 'platform') {
            failures.push(`${fromLabel} -> ${toLabel}: views는 platform을 참조할 수 없다`);
          }
          if (toLayer.layer === 'application') {
            failures.push(`${fromLabel} -> ${toLabel}: views는 application을 참조할 수 없다`);
          }
          const isDirectApi =
            /\/api\/|\/server\/|\/(sound|save|endlessMirror|sync)$|platform\/(audio\/sound|storage\/save)|(mirrorApi|stagesApi|accountApi|adminApi|endlessApi|localAuth|saveApi)$|.*Api(\.ts)?$/.test(
              dep.module,
            ) ||
            /\/api\/|\/server\/|\/(sound|save|endlessMirror|sync)(\.ts)?$|platform\/(audio\/sound|storage\/save)|(mirrorApi|stagesApi|accountApi|adminApi|endlessApi|localAuth|saveApi)(\.ts)?$/.test(
              toLabel,
            );
          if (isDirectApi) {
            failures.push(`${fromLabel} -> ${toLabel}: views는 직접 API/저장/환경 구현을 참조할 수 없다`);
          }
          if (toLayer.layer === 'feature' || toLayer.layer === 'views') {
            if (fromLayer.feature && toLayer.feature && fromLayer.feature !== toLayer.feature) {
              const allowed = ALLOWED_FEATURE_DEPS[fromLayer.feature] ?? [];
              if (!allowed.includes(toLayer.feature)) {
                failures.push(
                  `${fromLabel} -> ${toLabel}: 허용되지 않은 기능 의존성 (${fromLayer.feature} -> ${toLayer.feature})`,
                );
              }
            }
          }
        }

        // Server cannot import features (except side-effect-free domain validation), application, ui, platform
        if (fromLayer.layer === 'server') {
          if (['application', 'ui', 'platform', 'views'].includes(toLayer.layer)) {
            failures.push(`${fromLabel} -> ${toLabel}: server는 ${toLayer.layer}를 참조할 수 없다`);
          }
          const normalizedTo = toLabel.replace(/\.(tsx?|jsx?)$/, '');
          if (toLayer.layer === 'feature' && normalizedTo !== 'src/features/account/nickname') {
            failures.push(`${fromLabel} -> ${toLabel}: server는 도메인 검증 외의 feature를 참조할 수 없다`);
          }
        }

        // Client layers cannot import server
        if (['ui', 'platform', 'shared', 'application', 'views'].includes(fromLayer.layer)) {
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
        (path.endsWith('.tsx') || label(path).startsWith('src/views/')) &&
        !label(path).startsWith('src/features/') &&
        !/[/\\](queryClient|ErrorBoundary)\.tsx$/.test(path),
    );
    failures.push(...views.flatMap((path) => viewFailures(path)));
    expect(failures).toEqual([]);
  });

  it('합성 TSX fixture로 순수 모델 import, 타입 허용, 산술 연산, key 예외를 정밀 검증한다', () => {
    function analyzeFixture(content: string) {
      const source = ts.createSourceFile('fixture.tsx', content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      return viewFailures(join(process.cwd(), 'src/views/home/Fixture.tsx'), source)
        .map((failure) => failure.replace(/^.*?: View에서 /, ''));
    }

    // 1. extensionless pure import -> 탐지
    const res1 = analyzeFixture(`import { buttonClass } from "@/shared/classNames";\nexport function V() { return <div />; }`);
    expect(res1).toContain('순수 모델 직접 참조 (@/shared/classNames)');
    expect(analyzeFixture('import { rankModel as model } from "@/features/ranking/rankLogic"; export function V() { return <div />; }')).toHaveLength(1);
    expect(analyzeFixture('import { solve } from "@/features/sudoku/model/solver.ts"; export function V() { return <div />; }')).toHaveLength(1);
    expect(analyzeFixture('export { BOOT_TIMEOUT_MS } from "@/application/appLogic";')).toEqual([]);
    expect(analyzeFixture('export { rankModel as MODEL } from "@/features/ranking/rankLogic";')).toHaveLength(1);
    expect(analyzeFixture('import { useState as ownState } from "react"; export function V() { const [v] = ownState(0); return <div>{v}</div>; }').length).toBeGreaterThan(0);
    expect(analyzeFixture('import * as React from "react"; export function V() { const [v] = React.useState(0); return <div>{v}</div>; }').length).toBeGreaterThan(0);

    // 2. type import -> 허용 (탐지되지 않음)
    const res2 = analyzeFixture(`import type { Puzzle } from "@/features/sudoku/model/puzzles";\nexport function V() { return <div />; }`);
    expect(res2).toEqual([]);

    // 3. 곱셈/나눗셈/덧셈 -> 탐지
    const res3 = analyzeFixture(`export function V() { const a = 10 * 2; const b = 20 / 4; const c = 1 + 2; return <div>{a}</div>; }`);
    expect(res3).toHaveLength(3);

    // 4. key 안의 단순 key 구성 -> 예외 허용
    const res4 = analyzeFixture(`export function V() { return <ul>{[1,2].map(i => <li key={i + 1}>{i}</li>)}</ul>; }`);
    expect(res4).toEqual([]);
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
