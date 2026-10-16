import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
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
  if (top === 'presentation') {
    return parts[1] === 'views'
      ? { layer: 'views', feature: parts[2] }
      : { layer: parts[1] };
  }
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
      const isUiUtility = /\/src\/presentation\/ui\/(?:classNames|confettiModel)$/.test(norm);
      if (
        !isUiUtility &&
        (/(?:^|\/)(?:[^/]*Logic|boardProjection|screenModels|rules|tap|probe|path|solver|shape|catalog|classNames|confettiModel|validation|nickname)$/.test(norm) ||
        /\/features\/[^/]+\/model\//.test(norm))
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

function pageOverlayFailures(path: string, sourceOverride?: ts.SourceFile): string[] {
  const failures: string[] = [];
  inspect(path, (node) => {
    let tagName: string | null = null;
    if (ts.isJsxOpeningElement(node) && ts.isIdentifier(node.tagName)) {
      tagName = node.tagName.text;
    } else if (ts.isJsxSelfClosingElement(node) && ts.isIdentifier(node.tagName)) {
      tagName = node.tagName.text;
    }

    if (tagName && /^(ClearDialog|SettingsDialog|ProfileDialog|AuthDialog|RankDialog|GameOverDialog|EndlessClearDialog|GuestEndlessDialog|NicknameGateDialog)$/.test(tagName)) {
      failures.push(`${label(path)}: Page 또는 Board에서 특정 기능 오버레이 직접 JSX 선택 (${tagName})`);
    }
  }, sourceOverride);
  return failures;
}

describe('책임 경계와 기능 패키지 아키텍처', () => {
  it('레거시 src/game, src/screens, src/api, src/ui, src/views 모듈이 존재하지 않는다', () => {
    const legacyFiles = files
      .map(label)
      .filter((file) => /^src\/(game|screens|api|ui|views)\//.test(file));
    expect(legacyFiles).toEqual([]);
  });

  it('features에 제품 TSX가 존재하지 않는다', () => {
    const featureTsx = files
      .map(label)
      .filter((file) => /^src\/features\/.*\.tsx$/.test(file));
    expect(featureTsx).toEqual([]);
  });

  it('서버 런타임은 저장소 루트의 개발 도구를 참조하지 않는다', () => {
    const toolDependencies = files.flatMap((file) => {
      const from = label(file);
      if (!from.startsWith('src/server/')) return [];
      return getImportsAndExports(file)
        .filter((dep) => dep.resolved)
        .map((dep) => ({
          from,
          to: relative(process.cwd(), dep.resolved!).replaceAll('\\', '/'),
        }))
        .filter(({ to }) => to.startsWith('tools/'))
        .map(({ from, to }) => `${from} -> ${to}`);
    });
    expect(toolDependencies).toEqual([]);
  });

  it('Sudoku 생성 알고리즘은 순수 shared 도메인 모듈에 위치한다', () => {
    const sourcePaths = new Set(files.map(label));
    expect(sourcePaths.has('src/shared/sudoku/solver.ts')).toBe(true);
    expect(sourcePaths.has('src/shared/sudoku/logic.ts')).toBe(true);
    expect(sourcePaths.has('src/shared/sudoku/shape.ts')).toBe(true);
    expect(sourcePaths.has('src/shared/sudoku/difficulty.ts')).toBe(true);
    expect(sourcePaths.has('src/shared/sudoku/candidateGenerator.ts')).toBe(true);
    expect(sourcePaths.has('src/shared/sudoku/endlessPoolGenerator.ts')).toBe(true);
    expect(sourcePaths.has('src/server/puzzleCandidateGenerator.ts')).toBe(false);
    expect(sourcePaths.has('src/server/endlessPoolGenerator.ts')).toBe(false);
  });

  it('기능 구현은 api, model, service 책임 그룹 아래에 배치한다', () => {
    const misplaced = files.map(label).filter((file) =>
      file.startsWith('src/features/') && !/^src\/features\/[^/]+\/(api|model|service)\//.test(file),
    );
    expect(misplaced).toEqual([]);
  });

  it('core 구현은 조립과 앱 흐름 조율 책임으로 나눈다', () => {
    const coreRootModules = ['src/core/QueryProvider.tsx', 'src/core/ErrorBoundary.tsx'];
    const misplaced = files.map(label).filter((file) =>
      file.startsWith('src/core/') &&
      !/^src\/core\/(composition|orchestration)\//.test(file) &&
      !coreRootModules.includes(file),
    );
    expect(misplaced).toEqual([]);
  });

  it('core 흐름 조율은 React 조립 모듈을 역참조하지 않는다', () => {
    const reverseDependencies = files.flatMap((file) => {
      const from = label(file);
      if (!from.startsWith('src/core/orchestration/')) return [];
      return getImportsAndExports(file)
        .filter((dep) => dep.resolved)
        .map((dep) => ({ dep, to: relative(process.cwd(), dep.resolved!).replaceAll('\\', '/') }))
        .filter(({ to }) => to.startsWith('src/core/composition/'))
        .map(({ to }) => `${from} -> ${to}`);
    });
    expect(reverseDependencies).toEqual([]);
  });

  it('View 컴포넌트 파일명은 표현 역할 접미사를 사용한다', () => {
    const roleSuffix = /.+(Screen|Dialog|Overlay|Tabs|Tab|Board|List|Panel|Menu|Header|Input|Button|Status|Progress|Help|Cell)$/;
    const invalid = files.map(label).filter((file) => {
      if (!/^src\/presentation\/views\/.*\.tsx$/.test(file)) return false;
      return !roleSuffix.test(basename(file, '.tsx'));
    });
    expect(invalid).toEqual([]);
  });

  it('View 대표 컴포넌트 이름은 파일명과 일치한다', () => {
    const mismatched = files.map(label).filter((file) => {
      if (!/^src\/presentation\/views\/.*\.tsx$/.test(file)) return false;
      const componentNames = getSourceFile(join(process.cwd(), file)).statements
        .filter((statement): statement is ts.FunctionDeclaration =>
          ts.isFunctionDeclaration(statement) && Boolean(statement.name) &&
          Boolean(statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)),
        )
        .map((statement) => statement.name!.text);
      return !componentNames.includes(basename(file, '.tsx'));
    });
    expect(mismatched).toEqual([]);
  });

function validateLayerDependency(fromLabel: string, toLabel: string, dep: ImportInfo): string[] {
  const failures: string[] = [];
  const fromLayer = getLayer(fromLabel);
  const toLayer = getLayer(toLabel);

  // Generic layers cannot import presentation, feature or application modules.
  if (['platform', 'ui', 'layouts', 'shared'].includes(fromLayer.layer)) {
    if (['views', 'feature', 'core', 'application'].includes(toLayer.layer)) {
      failures.push(`${fromLabel} -> ${toLabel}: ${fromLayer.layer}는 views/features/core를 참조할 수 없다`);
    }
  }

  // Feature cannot import views, core, application or server
  if (fromLayer.layer === 'feature') {
    if (toLayer.layer === 'views') {
      failures.push(`${fromLabel} -> ${toLabel}: feature는 views를 참조할 수 없다`);
    }
    if (toLayer.layer === 'core' || toLayer.layer === 'application') {
      failures.push(`${fromLabel} -> ${toLabel}: feature는 core를 참조할 수 없다`);
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

  // Views cannot import server, platform, core, application or direct API
  if (fromLayer.layer === 'views') {
    if (toLayer.layer === 'server') {
      failures.push(`${fromLabel} -> ${toLabel}: views는 server를 참조할 수 없다`);
    }
    if (toLayer.layer === 'platform') {
      failures.push(`${fromLabel} -> ${toLabel}: views는 platform을 참조할 수 없다`);
    }
    if (toLayer.layer === 'core' || toLayer.layer === 'application') {
      failures.push(`${fromLabel} -> ${toLabel}: views는 core를 참조할 수 없다`);
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

  // Server cannot import features (except side-effect-free domain validation), core, application, ui, platform
  if (fromLayer.layer === 'server') {
    if (['core', 'application', 'ui', 'platform', 'views'].includes(toLayer.layer)) {
      failures.push(`${fromLabel} -> ${toLabel}: server는 ${toLayer.layer}를 참조할 수 없다`);
    }
    const normalizedTo = toLabel.replace(/\.(tsx?|jsx?)$/, '');
    if (toLayer.layer === 'feature' && normalizedTo !== 'src/features/account/nickname' && normalizedTo !== 'src/features/account/model/nickname') {
      failures.push(`${fromLabel} -> ${toLabel}: server는 도메인 검증 외의 feature를 참조할 수 없다`);
    }
  }

  // Client layers cannot import server
  if (['ui', 'layouts', 'platform', 'shared', 'core', 'application', 'views'].includes(fromLayer.layer)) {
    if (toLayer.layer === 'server') {
      failures.push(`${fromLabel} -> ${toLabel}: ${fromLayer.layer}는 server를 참조할 수 없다`);
    }
  }

  return failures;
}

  it('기능 간 허용된 비순환 의존성만 존재하며 상위/하위 계층 규칙을 준수한다', () => {
    const failures: string[] = [];
    for (const file of files) {
      const fromLabel = label(file);
      const deps = getImportsAndExports(file);

      for (const dep of deps) {
        if (!dep.resolved) continue;
        const toLabel = relative(process.cwd(), dep.resolved).replaceAll('\\', '/');
        if (!toLabel.startsWith('src/')) continue;
        failures.push(...validateLayerDependency(fromLabel, toLabel, dep));
      }
    }
    expect(failures).toEqual([]);
  });

  it('View는 상태·생명주기와 입출력 구현을 직접 소유하지 않는다', () => {
    const failures: string[] = [];
    const views = files.filter(
      (path) =>
        path.endsWith('.tsx') &&
        !label(path).startsWith('src/features/') &&
        !/[/\\](queryClient|QueryProvider|ErrorBoundary)\.tsx$/.test(path),
    );
    failures.push(...views.flatMap((path) => viewFailures(path)));
    expect(failures).toEqual([]);
  });

  it('합성 TSX fixture로 순수 모델 import, 타입 허용, 산술 연산, key 예외를 정밀 검증한다', () => {
    function analyzeFixture(content: string) {
      const source = ts.createSourceFile('fixture.tsx', content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      return viewFailures(join(process.cwd(), 'src/presentation/views/home/Fixture.tsx'), source)
        .map((failure) => failure.replace(/^.*?: View에서 /, ''));
    }

    // 1. extensionless pure import -> 탐지
    const res1 = analyzeFixture(`import { buttonClass } from "@/shared/classNames";\nexport function V() { return <div />; }`);
    expect(res1).toContain('순수 모델 직접 참조 (@/shared/classNames)');
    // 순수 UI 유틸리티 직접 import -> 허용 (탐지되지 않음)
    expect(analyzeFixture('import { buttonClass } from "@/presentation/ui/classNames"; export function V() { return <div />; }')).toEqual([]);
    expect(analyzeFixture('import { confettiPiecesModel } from "@/presentation/ui/confettiModel"; export function V() { return <div />; }')).toEqual([]);
    expect(analyzeFixture('import { rankModel as model } from "@/features/ranking/model/rankLogic"; export function V() { return <div />; }')).toHaveLength(1);
    expect(analyzeFixture('import { applyRules } from "@/features/sudoku/model/rules.ts"; export function V() { return <div />; }')).toHaveLength(1);
    expect(analyzeFixture('export { BOOT_TIMEOUT_MS } from "@/application/appLogic";')).toEqual([]);
    expect(analyzeFixture('export { BOOT_TIMEOUT_MS } from "@/core/orchestration/appLogic";')).toEqual([]);
    expect(analyzeFixture('export { rankModel as MODEL } from "@/features/ranking/model/rankLogic";')).toHaveLength(1);
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

function isServiceDirectAccessTarget(name: string): boolean {
  if (!name.startsWith('src/features/') && !name.startsWith('src/core/') && !name.startsWith('src/application/')) return false;
  if (/\/api\/|(?:Api|localAuth|endlessMirror|mirrorApi|sync)\.ts$/.test(name)) return false;
  return true;
}

function inspectServiceDirectAccess(path: string, sourceOverride?: ts.SourceFile): string[] {
  const failures: string[] = [];
  inspect(path, (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'fetch') {
      failures.push(`${label(path)}: HTTP 직접 호출`);
    }
    if (ts.isIdentifier(node) && ['localStorage', 'sessionStorage'].includes(node.text)) {
      failures.push(`${label(path)}: 저장 엔진 직접 접근`);
    }
  }, sourceOverride);
  return failures;
}

  it('Service는 HTTP와 로컬 저장 엔진을 직접 호출하지 않는다', () => {
    const failures: string[] = [];
    const targetFiles = files.filter((file) => isServiceDirectAccessTarget(label(file)));
    for (const path of targetFiles) {
      failures.push(...inspectServiceDirectAccess(path));
    }
    expect(failures).toEqual([]);
  });

  function isApiReactDependency(name: string, dep: ImportInfo): boolean {
    return !dep.isTypeOnly &&
      (name.startsWith('src/api/') || /^src\/features\/[^/]+\/api\//.test(name) || /(Api|sync|localAuth)\.ts$/.test(name)) &&
      /^(react|react-dom)$/.test(dep.module);
  }

  it('중첩 API의 React 참조를 파일명과 무관하게 차단한다', () => {
    const source = ts.createSourceFile('fixture.ts',
      'import { useState } from "react"; import { createPortal } from "react-dom"; import type { ReactNode } from "react";',
      ts.ScriptTarget.Latest, true);
    const deps = getImportsAndExports(join(process.cwd(), 'src/features/endless/api/persistence.ts'), source);
    for (const name of ['src/features/endless/api/persistence.ts', 'src/features/endless/api/endlessMirror.ts']) {
      expect(deps.filter((dep) => isApiReactDependency(name, dep)).map((dep) => dep.module))
        .toEqual(['react', 'react-dom']);
    }
    expect(deps.filter((dep) => isApiReactDependency('src/features/endless/service/useEndlessSession.ts', dep)))
      .toEqual([]);
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
        if (!name.startsWith('src/server/') && dep.module.startsWith('node:')) {
          failures.push(`${name}: 클라이언트 경계의 Node 내장 모듈 참조`);
        }
        if (isApiReactDependency(name, dep)) {
          failures.push(`${name}: API에서 React 참조`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

function inspectPureFailures(path: string, sourceOverride?: ts.SourceFile): string[] {
  const failures: string[] = [];
  for (const dep of getImportsAndExports(path, sourceOverride)) {
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
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'Date' &&
      node.name.text === 'now'
    ) {
      failures.push(`${label(path)}: 환경 접근 Date.now`);
    }
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'Date' &&
      (!node.arguments || node.arguments.length === 0)
    ) {
      failures.push(`${label(path)}: 환경 접근 new Date()`);
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'Math' &&
      node.name.text === 'random'
    ) {
      failures.push(`${label(path)}: 환경 접근 Math.random`);
    }
  }, sourceOverride);
  return failures;
}

  it('순수 Logic은 환경과 입출력 구현에 의존하지 않는다', () => {
    const failures: string[] = [];
    const logic = files.filter((path) => {
      const name = label(path);
      return (
        name.startsWith('src/shared/') ||
        name.startsWith('src/features/sudoku/model/') ||
        /\/features\/[^/]+\/model\//.test(name) ||
        /\/(selectionLogic|catalog|homeLogic|rankLogic|nickname|validation)\.ts$/.test(name) ||
        /\/(appLogic|gameTransition|forms|screenModels|boardProjection|stageCatalog|rules|tap|probe|path|solver|shape|logic|nickname)\.ts$/.test(
          name,
        ) ||
        /\/(classNames|confettiModel|timeFormatter|clearDialogPresentation|probeButtonPresentation)\.ts$/.test(name)
      );
    });
    for (const path of logic) {
      failures.push(...inspectPureFailures(path));
    }
    expect(failures).toEqual([]);
  });

  it('순수 UI utility와 도메인 Logic의 Date.now·new Date·Math.random 환경 접근을 엄격히 탐지한다', () => {
    function analyzePureFixture(content: string) {
      const source = ts.createSourceFile('fixture.ts', content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      return inspectPureFailures(join(process.cwd(), 'src/presentation/ui/classNames.ts'), source);
    }

    expect(analyzePureFixture('export function f() { return Date.now(); }')).toHaveLength(1);
    expect(analyzePureFixture('export function f() { return new Date(); }')).toHaveLength(1);
    expect(analyzePureFixture('export function f() { return Math.random(); }')).toHaveLength(1);
  });

  it('합성 TSX fixture로 Page와 Board의 특정 오버레이 직접 JSX 금지를 정밀 검증한다', () => {
    function analyzeOverlayFixture(content: string) {
      const source = ts.createSourceFile('fixture.tsx', content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      return pageOverlayFailures(join(process.cwd(), 'src/presentation/views/home/HomeScreen.tsx'), source);
    }

    // 1. ClearDialog / SettingsDialog 직접 JSX -> 탐지
    expect(analyzeOverlayFixture('export function Page() { return <div><ClearDialog /></div>; }')).toHaveLength(1);
    expect(analyzeOverlayFixture('export function Page() { return <div><SettingsDialog /></div>; }')).toHaveLength(1);

    // 2. OverlayOutlet 공통 슬롯 사용 및 Overlay 프레임 사용 -> 허용
    expect(analyzeOverlayFixture('export function Page() { return <div><OverlayOutlet /></div>; }')).toEqual([]);
    expect(analyzeOverlayFixture('export function Page() { return <div><Overlay label="테스트"><div /></Overlay></div>; }')).toEqual([]);
  });

  it('Page와 Board는 특정 기능 오버레이를 직접 JSX로 선택하지 않는다', () => {
    const pageAndBoardFiles = files.filter((path) =>
      /(?:HomeScreen|GameScreen|EndlessGameScreen|Board)\.tsx$/.test(label(path)),
    );
    const failures = pageAndBoardFiles.flatMap((path) => pageOverlayFailures(path));
    expect(failures).toEqual([]);
  });

  it('core 상위 경계 및 중첩 api/model/service 식별 fixture를 검증한다', () => {
    // 1. feature -> core 역참조 금지
    expect(
      validateLayerDependency('src/features/account/service/useAccount.ts', 'src/core/orchestration/appLogic.ts', {
        module: '@/core/orchestration/appLogic',
        resolved: join(process.cwd(), 'src/core/orchestration/appLogic.ts').replaceAll('\\', '/'),
        names: ['BOOT_TIMEOUT_MS'],
        isTypeOnly: false,
      }),
    ).toContain('src/features/account/service/useAccount.ts -> src/core/orchestration/appLogic.ts: feature는 core를 참조할 수 없다');

    // 2. views -> core 역참조 금지
    expect(
      validateLayerDependency('src/presentation/views/home/HomeScreen.tsx', 'src/core/orchestration/appLogic.ts', {
        module: '@/core/orchestration/appLogic',
        resolved: join(process.cwd(), 'src/core/orchestration/appLogic.ts').replaceAll('\\', '/'),
        names: ['BOOT_TIMEOUT_MS'],
        isTypeOnly: false,
      }),
    ).toContain('src/presentation/views/home/HomeScreen.tsx -> src/core/orchestration/appLogic.ts: views는 core를 참조할 수 없다');

    // 3. 공통 계층에서 앱 흐름 역참조 금지
    expect(
      validateLayerDependency('src/presentation/ui/Button.tsx', 'src/core/orchestration/appLogic.ts', {
        module: '@/core/orchestration/appLogic',
        resolved: join(process.cwd(), 'src/core/orchestration/appLogic.ts').replaceAll('\\', '/'),
        names: ['BOOT_TIMEOUT_MS'],
        isTypeOnly: false,
      }),
    ).toContain('src/presentation/ui/Button.tsx -> src/core/orchestration/appLogic.ts: ui는 views/features/core를 참조할 수 없다');

    expect(
      validateLayerDependency('src/presentation/layouts/AppShell.tsx', 'src/core/composition/AppShell.tsx', {
        module: '@/core/composition/AppShell',
        resolved: join(process.cwd(), 'src/core/composition/AppShell.tsx').replaceAll('\\', '/'),
        names: ['AppShell'],
        isTypeOnly: false,
      }),
    ).toContain('src/presentation/layouts/AppShell.tsx -> src/core/composition/AppShell.tsx: layouts는 views/features/core를 참조할 수 없다');

    // 4. views -> 중첩 API 직접 참조 금지
    expect(
      validateLayerDependency('src/presentation/views/home/HomeScreen.tsx', 'src/features/account/api/accountApi.ts', {
        module: '@/features/account/api/accountApi',
        resolved: join(process.cwd(), 'src/features/account/api/accountApi.ts').replaceAll('\\', '/'),
        names: ['authApi'],
        isTypeOnly: false,
      }),
    ).toContain('src/presentation/views/home/HomeScreen.tsx -> src/features/account/api/accountApi.ts: views는 직접 API/저장/환경 구현을 참조할 수 없다');

    // 5. core 및 service에서 fetch/localStorage 직접 호출 금지
    expect(isServiceDirectAccessTarget('src/core/orchestration/appLogic.ts')).toBe(true);
    expect(isServiceDirectAccessTarget('src/features/account/service/useAccount.ts')).toBe(true);
    expect(isServiceDirectAccessTarget('src/features/account/api/accountApi.ts')).toBe(false);

    expect(
      inspectServiceDirectAccess(
        'src/core/orchestration/appLogic.ts',
        ts.createSourceFile('appLogic.ts', 'export function boot() { fetch("/api"); }', ts.ScriptTarget.Latest, true),
      ),
    ).toContain('src/core/orchestration/appLogic.ts: HTTP 직접 호출');

    expect(
      inspectServiceDirectAccess(
        'src/features/account/service/useAccount.ts',
        ts.createSourceFile('useAccount.ts', 'export function f() { localStorage.getItem("x"); }', ts.ScriptTarget.Latest, true),
      ),
    ).toContain('src/features/account/service/useAccount.ts: 저장 엔진 직접 접근');

    // 6. views에서 중첩 model 값 직접 참조 금지 (타입 import는 허용)
    const viewFixtureWithValue = ts.createSourceFile(
      'Fixture.tsx',
      'import { authState } from "@/features/account/model/authState"; export function V() { return <div>{String(authState)}</div>; }',
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    expect(
      viewFailures('src/presentation/views/home/Fixture.tsx', viewFixtureWithValue),
    ).toContain('src/presentation/views/home/Fixture.tsx: View에서 순수 모델 직접 참조 (@/features/account/model/authState)');

    const viewFixtureWithType = ts.createSourceFile(
      'Fixture.tsx',
      'import type { AuthState } from "@/features/account/model/authState"; export function V() { return <div />; }',
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    expect(
      viewFailures('src/presentation/views/home/Fixture.tsx', viewFixtureWithType),
    ).toEqual([]);

    // 7. 순수 규칙에서 환경 접근(Date.now/Math.random/fetch) 금지
    const modelFixtureWithEnv = ts.createSourceFile(
      'authState.ts',
      'export function getTime() { return Date.now(); }',
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    expect(
      inspectPureFailures('src/features/account/model/authState.ts', modelFixtureWithEnv),
    ).toContain('src/features/account/model/authState.ts: 환경 접근 Date.now');
  });

});

// ---- 서버 데이터 계층 ----

// 서버 기능과 허용 의존. 다른 기능의 테이블은 SQL 안에서 읽을 수 있고 쓰기는 소유 기능의 store만 수행한다.
const SERVER_FEATURES = new Set(['account', 'attempt', 'stageRecord', 'endlessPool', 'endlessPlay', 'seasonRanking']);
const ALLOWED_SERVER_FEATURE_DEPS: Record<string, string[]> = {
  account: [],
  attempt: [],
  endlessPool: [],
  stageRecord: ['attempt'],
  endlessPlay: ['attempt', 'endlessPool', 'seasonRanking'],
  seasonRanking: ['account'],
};

// 기존 저장소 계약(server/db/prisma·port)을 직접 쓰는 이관 전 route handler. 이관 태스크마다 목록을 줄인다.
const LEGACY_ROUTE_DB_IMPORTS = new Set([
  'src/app/api/endless/clear/route.ts',
  'src/app/api/endless/fail/route.ts',
  'src/app/api/endless/me/route.ts',
  'src/app/api/endless/next/route.ts',
]);

type ServerRole = 'route' | 'db' | 'schema' | 'store' | 'queries' | 'rules' | 'useCase' | 'other';

function serverModule(relPath: string): { role: ServerRole; feature?: string } {
  const path = relPath.replace(/\.(tsx?|jsx?)$/, '');
  if (/^src\/app\/api\/.+\/route$/.test(path)) return { role: 'route' };
  if (path.startsWith('src/server/db/')) return { role: 'db' };
  const match = /^src\/server\/([^/]+)\/(.+)$/.exec(path);
  if (!match || !SERVER_FEATURES.has(match[1])) return { role: 'other' };
  const file = match[2];
  const role: ServerRole =
    file === 'schema' || file === 'store' || file === 'queries' || file === 'rules' ? file : 'useCase';
  return { role, feature: match[1] };
}

const QUERY_BUILDER = /^drizzle-orm(\/|$)/;
const WRITE_METHODS = new Set(['insert', 'update', 'delete']);

function writeCalls(path: string, sourceOverride?: ts.SourceFile): { method: string; target: string }[] {
  const calls: { method: string; target: string }[] = [];
  inspect(
    path,
    (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        WRITE_METHODS.has(node.expression.name.text) &&
        node.arguments[0] &&
        ts.isIdentifier(node.arguments[0])
      ) {
        calls.push({ method: node.expression.name.text, target: node.arguments[0].text });
      }
    },
    sourceOverride,
  );
  return calls;
}

function serverLayerFailures(path: string, sourceOverride?: ts.SourceFile): string[] {
  const fromLabel = label(path);
  const from = serverModule(fromLabel);
  if (from.role === 'other' || from.role === 'schema') return [];
  const failures: string[] = [];
  const foreignTables = new Set<string>();

  for (const dep of getImportsAndExports(path, sourceOverride)) {
    if (QUERY_BUILDER.test(dep.module)) {
      const subject = from.role === 'route' ? 'route handler' : from.role === 'useCase' ? 'use case' : from.role;
      if (from.role === 'route' || from.role === 'useCase' || from.role === 'rules') {
        failures.push(`${fromLabel} -> ${dep.module}: ${subject}는 쿼리 빌더를 참조할 수 없다`);
      }
      continue;
    }
    if (!dep.resolved) continue;
    const toLabel = label(dep.resolved);
    const to = serverModule(toLabel);

    if (from.role === 'route' && ['db', 'schema', 'store', 'queries'].includes(to.role)) {
      failures.push(`${fromLabel} -> ${toLabel}: route handler는 ${to.role}를 참조할 수 없다`);
    }
    if (from.role === 'useCase' && to.role === 'schema') {
      failures.push(`${fromLabel} -> ${toLabel}: use case는 schema를 참조할 수 없다`);
    }
    if (from.role === 'rules' && ['db', 'schema', 'store', 'queries'].includes(to.role)) {
      failures.push(`${fromLabel} -> ${toLabel}: rules는 ${to.role}를 참조할 수 없다`);
    }
    if ((from.role === 'store' || from.role === 'queries') && toLabel === 'src/server/db/client') {
      for (const name of dep.names.filter((n) => n === 'db' || n === 'withTransaction')) {
        failures.push(`${fromLabel} -> ${toLabel}: ${from.role}는 전역 db 인스턴스(${name})를 참조할 수 없다`);
      }
    }
    if (from.role === 'db' && to.feature) {
      failures.push(`${fromLabel} -> ${toLabel}: db는 기능 모듈을 참조할 수 없다`);
    }
    if (from.feature && to.feature && from.feature !== to.feature) {
      if (!(ALLOWED_SERVER_FEATURE_DEPS[from.feature] ?? []).includes(to.feature)) {
        failures.push(`${fromLabel} -> ${toLabel}: 허용되지 않은 서버 기능 의존성 (${from.feature} -> ${to.feature})`);
      }
      if (to.role === 'schema') for (const name of dep.names) foreignTables.add(name);
    }
  }

  if (from.role === 'queries') {
    for (const call of writeCalls(path, sourceOverride)) {
      failures.push(`${fromLabel}: queries는 쓰기(${call.method})를 수행할 수 없다`);
    }
  }
  if (from.role === 'store') {
    for (const call of writeCalls(path, sourceOverride).filter((c) => foreignTables.has(c.target))) {
      failures.push(`${fromLabel}: 다른 기능 테이블 쓰기 (${call.method} ${call.target})`);
    }
  }
  return failures;
}

// 트랜잭션 풀러는 문장마다 다른 서버 연결을 줄 수 있다. 연결에 남는 상태를 만드는 사용을 금지한다.
const SESSION_ADVISORY_LOCK = /\bpg_(try_)?advisory_lock(_shared)?\s*\(/i;
const SESSION_SET = /(^|;)\s*set\s+(?!local\b)(session\s+)?[a-z_][\w.]*\s*(=|to\b)/i;

function literalText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return node.head.text + node.templateSpans.map((span) => `?${span.literal.text}`).join('');
  }
  return null;
}

function poolerFailures(path: string, sourceOverride?: ts.SourceFile): string[] {
  const fileLabel = label(path);
  const failures: string[] = [];
  inspect(
    path,
    (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'prepare'
      ) {
        failures.push(`${fileLabel}: prepared statement 사용`);
      }
      const text = literalText(node);
      if (text === null) return;
      if (SESSION_ADVISORY_LOCK.test(text)) failures.push(`${fileLabel}: 세션 수준 advisory lock 사용`);
      if (SESSION_SET.test(text)) failures.push(`${fileLabel}: 트랜잭션 밖에서 유지되는 SET 사용`);
    },
    sourceOverride,
  );
  return failures;
}

function fixture(relPath: string, code: string): [string, ts.SourceFile] {
  const path = join(process.cwd(), relPath);
  return [path, ts.createSourceFile(basename(relPath), code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)];
}

describe('서버 데이터 계층 경계', () => {
  it('route handler는 db·schema·store·queries와 쿼리 빌더를 참조하지 않는다', () => {
    const [path, source] = fixture(
      'src/app/api/fixture/route.ts',
      [
        "import { db } from '../../../server/db/client';",
        "import { attempts } from '../../../server/attempt/schema';",
        "import { consumeAttempt } from '../../../server/attempt/store';",
        "import { listRecords } from '../../../server/stageRecord/queries';",
        "import { sql } from 'drizzle-orm';",
        "import { submitClear } from '../../../server/stageRecord/submitClear';",
      ].join('\n'),
    );
    expect(serverLayerFailures(path, source)).toEqual([
      'src/app/api/fixture/route.ts -> src/server/db/client: route handler는 db를 참조할 수 없다',
      'src/app/api/fixture/route.ts -> src/server/attempt/schema: route handler는 schema를 참조할 수 없다',
      'src/app/api/fixture/route.ts -> src/server/attempt/store: route handler는 store를 참조할 수 없다',
      'src/app/api/fixture/route.ts -> src/server/stageRecord/queries: route handler는 queries를 참조할 수 없다',
      'src/app/api/fixture/route.ts -> drizzle-orm: route handler는 쿼리 빌더를 참조할 수 없다',
    ]);
  });

  it('use case는 쿼리 빌더와 schema를 참조하지 않고 db와 트랜잭션 경계만 사용한다', () => {
    const [path, source] = fixture(
      'src/server/stageRecord/submitClear.ts',
      [
        "import { db, withTransaction, type Executor } from '../db/client';",
        "import { eq } from 'drizzle-orm';",
        "import type { clearRecords } from './schema';",
        "import { recordClear } from './store';",
      ].join('\n'),
    );
    expect(serverLayerFailures(path, source)).toEqual([
      'src/server/stageRecord/submitClear.ts -> drizzle-orm: use case는 쿼리 빌더를 참조할 수 없다',
      'src/server/stageRecord/submitClear.ts -> src/server/stageRecord/schema: use case는 schema를 참조할 수 없다',
    ]);
  });

  it('store와 queries는 전역 db 인스턴스 대신 실행 객체 인자를 사용한다', () => {
    const [storePath, store] = fixture(
      'src/server/attempt/store.ts',
      "import { db, type Executor } from '../db/client';\nimport { withTransaction } from '../db/client';",
    );
    expect(serverLayerFailures(storePath, store)).toEqual([
      'src/server/attempt/store.ts -> src/server/db/client: store는 전역 db 인스턴스(db)를 참조할 수 없다',
      'src/server/attempt/store.ts -> src/server/db/client: store는 전역 db 인스턴스(withTransaction)를 참조할 수 없다',
    ]);
    const [queriesPath, queries] = fixture('src/server/attempt/queries.ts', "import type { Executor } from '../db/client';");
    expect(serverLayerFailures(queriesPath, queries)).toEqual([]);
  });

  it('queries는 쓰기를 수행하지 않는다', () => {
    const [path, source] = fixture(
      'src/server/account/queries.ts',
      [
        "import type { Executor } from '../db/client';",
        "import { profiles } from './schema';",
        'export async function f(tx: Executor) {',
        '  await tx.update(profiles).set({ nickname: null });',
        '  await tx.select().from(profiles);',
        '}',
      ].join('\n'),
    );
    expect(serverLayerFailures(path, source)).toEqual(['src/server/account/queries.ts: queries는 쓰기(update)를 수행할 수 없다']);
  });

  it('rules는 db·쿼리 빌더·schema·store·queries를 참조하지 않는다', () => {
    const [path, source] = fixture(
      'src/server/endlessPlay/rules.ts',
      "import { sql } from 'drizzle-orm';\nimport { endlessEvents } from './schema';",
    );
    expect(serverLayerFailures(path, source)).toEqual([
      'src/server/endlessPlay/rules.ts -> drizzle-orm: rules는 쿼리 빌더를 참조할 수 없다',
      'src/server/endlessPlay/rules.ts -> src/server/endlessPlay/schema: rules는 schema를 참조할 수 없다',
    ]);
  });

  it('db 모듈은 기능 모듈을 참조하지 않는다', () => {
    const [path, source] = fixture('src/server/db/client.ts', "import { users } from '../account/schema';");
    expect(serverLayerFailures(path, source)).toEqual([
      'src/server/db/client.ts -> src/server/account/schema: db는 기능 모듈을 참조할 수 없다',
    ]);
  });

  it('기능 간 의존은 허용 목록만 따른다', () => {
    const [allowedPath, allowed] = fixture(
      'src/server/endlessPlay/submitClear.ts',
      "import { appendEarning } from '../seasonRanking/store';\nimport { consumeAttempt } from '../attempt/store';",
    );
    expect(serverLayerFailures(allowedPath, allowed)).toEqual([]);
    const [deniedPath, denied] = fixture('src/server/attempt/store.ts', "import { recordStagePlay } from '../endlessPool/store';");
    expect(serverLayerFailures(deniedPath, denied)).toEqual([
      'src/server/attempt/store.ts -> src/server/endlessPool/store: 허용되지 않은 서버 기능 의존성 (attempt -> endlessPool)',
    ]);
  });

  it('store는 다른 기능 schema의 테이블에 쓰지 않는다', () => {
    const [path, source] = fixture(
      'src/server/endlessPlay/store.ts',
      [
        "import type { Executor } from '../db/client';",
        "import { endlessStages } from '../endlessPool/schema';",
        "import { seedWallets } from './schema';",
        'export async function f(tx: Executor) {',
        "  await tx.insert(seedWallets).values({ userId: 'u' });",
        '  await tx.update(endlessStages).set({ plays: 1 });',
        '  await tx.select().from(endlessStages);',
        '}',
      ].join('\n'),
    );
    expect(serverLayerFailures(path, source)).toEqual([
      'src/server/endlessPlay/store.ts: 다른 기능 테이블 쓰기 (update endlessStages)',
    ]);
  });

  it('트랜잭션 풀러와 맞지 않는 prepared statement, 세션 잠금, 세션 SET을 사용하지 않는다', () => {
    const [path, source] = fixture(
      'src/server/endlessPlay/store.ts',
      [
        "import { sql } from 'drizzle-orm';",
        'export async function f(tx) {',
        "  await tx.select().from(t).prepare('named');",
        '  await tx.execute(sql`select pg_advisory_lock(${1})`);',
        '  await tx.execute(sql`select pg_try_advisory_lock_shared(1)`);',
        '  await tx.execute(sql`set statement_timeout = 0`);',
        '  await tx.execute(sql`select pg_advisory_xact_lock_shared(${1})`);',
        '  await tx.execute(sql`set local lock_timeout = 1000`);',
        '  await tx.execute(sql`update ${t} set "plays" = 1`);',
        '}',
      ].join('\n'),
    );
    expect(poolerFailures(path, source)).toEqual([
      'src/server/endlessPlay/store.ts: prepared statement 사용',
      'src/server/endlessPlay/store.ts: 세션 수준 advisory lock 사용',
      'src/server/endlessPlay/store.ts: 세션 수준 advisory lock 사용',
      'src/server/endlessPlay/store.ts: 트랜잭션 밖에서 유지되는 SET 사용',
    ]);
  });

  it('서버 모듈과 route handler가 서버 데이터 계층 규칙을 준수한다', () => {
    const failures: string[] = [];
    for (const file of files) {
      const fileLabel = label(file);
      if (!fileLabel.startsWith('src/server/') && !fileLabel.startsWith('src/app/api/')) continue;
      failures.push(...poolerFailures(file));
      if (LEGACY_ROUTE_DB_IMPORTS.has(fileLabel)) continue;
      failures.push(...serverLayerFailures(file));
    }
    expect(failures).toEqual([]);
  });

  it('이관 전 예외 목록은 아직 기존 저장소 계약을 직접 쓰는 route handler만 담는다', () => {
    const stale = [...LEGACY_ROUTE_DB_IMPORTS].filter(
      (routeLabel) =>
        !getImportsAndExports(join(process.cwd(), routeLabel)).some((dep) =>
          dep.resolved ? /\/src\/server\/db\/(prisma|port)$/.test(dep.resolved) : false,
        ),
    );
    expect(stale).toEqual([]);
  });
});
