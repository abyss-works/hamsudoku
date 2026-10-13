import fs from 'node:fs';
import { LEVEL_CONFIGS, poolTarget, type GeneratedLevel } from '../src/features/sudoku/model/levels';
import { inBand } from '../src/shared/sudoku/difficulty';
import { WEIGHTS } from '../src/shared/sudoku/logic';
import { MAX_ATTEMPTS, mulberry32, sampleCandidate, type Candidate } from '../src/shared/sudoku/candidateGenerator';

export function pickSpread<T>(sorted: T[], count: number): T[] {
  if (count <= 1) return sorted.slice(0, count);
  const out: T[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(sorted[Math.round((i * (sorted.length - 1)) / (count - 1))]);
  }
  return out;
}

export interface PoolInfo {
  level: number;
  pool: number;
  scoreMin: number;
  scoreMax: number;
}

export function generateLevel(level: number, seed: number): { levels: GeneratedLevel[]; info: PoolInfo } {
  const cfg = LEVEL_CONFIGS[level];
  if (!cfg) throw new Error(`알 수 없는 레벨: ${level}`);
  const rand = mulberry32(seed + level);
  const pool: Candidate[] = [];
  const seen = new Set<string>();
  const target = poolTarget(cfg);
  const started = Date.now();
  let attempt = 0;
  for (; attempt < MAX_ATTEMPTS && pool.length < target; attempt += 1) {
    if (attempt > 0 && attempt % 100 === 0) {
      console.error(`레벨 ${level}: 표본 ${attempt}, 풀 ${pool.length}/${target}, ${(Date.now() - started) / 1000}s`);
    }
    const cand = sampleCandidate(cfg.size, rand);
    if (!cand) continue;
    const key = JSON.stringify(cand.islands);
    if (seen.has(key)) continue;
    if (!inBand(cand.m, cand.sh, cfg)) continue;
    seen.add(key);
    pool.push(cand);
  }
  if (pool.length < cfg.count) {
    throw new Error(`레벨 ${level}: 표본 ${attempt}개 중 밴드 안 후보 ${pool.length}개 (필요 ${cfg.count})`);
  }
  // 점수 오름차순. 동점이면 한 칸 섬이 많고 일자섬 비율이 높은 쪽을 쉬운 것으로 앞에 둔다.
  pool.sort(
    (a, b) =>
      a.m.score - b.m.score ||
      b.sh.singles - a.sh.singles ||
      b.sh.straightRatio - a.sh.straightRatio ||
      JSON.stringify(a.islands).localeCompare(JSON.stringify(b.islands)),
  );
  const picked = pickSpread(pool, cfg.count);
  return {
    levels: picked.map((p, i) => ({
      level,
      no: i + 1,
      code: `${level}-${i + 1}`,
      puzzle: { name: '', size: cfg.size, islands: p.islands, solution: p.solution },
      measure: p.m,
    })),
    info: { level, pool: pool.length, scoreMin: pool[0].m.score, scoreMax: pool[pool.length - 1].m.score },
  };
}

export function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export interface ReportRow {
  tier: number;
  t1: number;
  t2: number;
  t3: number;
  maxChain: number;
  score: number;
  singles: number;
}

const Q = [10, 25, 50, 75, 90] as const;
type Quantiles = Record<(typeof Q)[number], number>;

export interface Summary {
  tiers: Record<0 | 1 | 2 | 3 | 4, number>;
  t1: Quantiles;
  t2: Quantiles;
  t3: Quantiles;
  maxChain: Quantiles;
  score: Quantiles;
  singles: Record<number, number>;
}

function quantiles(values: number[]): Quantiles {
  const sorted = [...values].sort((a, b) => a - b);
  return Object.fromEntries(Q.map((p) => [p, quantile(sorted, p)])) as Quantiles;
}

export function summarize(rows: ReportRow[]): Summary {
  const tiers: Summary['tiers'] = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  const singles: Record<number, number> = {};
  for (const r of rows) {
    tiers[r.tier as 0 | 1 | 2 | 3 | 4] += 1;
    singles[r.singles] = (singles[r.singles] ?? 0) + 1;
  }
  const finite = rows.filter((r) => r.tier < 4);
  return {
    tiers,
    t1: quantiles(finite.map((r) => r.t1)),
    t2: quantiles(finite.map((r) => r.t2)),
    t3: quantiles(finite.map((r) => r.t3)),
    maxChain: quantiles(finite.map((r) => r.maxChain)),
    score: quantiles(finite.map((r) => r.score)),
    singles,
  };
}

export function report(size: number, samples: number, seed: number): { summary: Summary; rows: ReportRow[] } {
  const rand = mulberry32(seed);
  const rows: ReportRow[] = [];
  const seen = new Set<string>();
  for (let attempt = 0; attempt < samples * 20 && rows.length < samples; attempt += 1) {
    const cand = sampleCandidate(size, rand);
    if (!cand) continue;
    const key = JSON.stringify(cand.islands);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ ...cand.m, singles: cand.sh.singles });
  }
  return { summary: summarize(rows), rows };
}

interface Args {
  mode: 'generate' | 'report';
  seed: number;
  levels: number[];
  out: string | null;
  size: number;
  samples: number;
}

function argValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function parseArgs(argv: string[]): Args {
  const known = Object.keys(LEVEL_CONFIGS).map(Number);
  const seed = Number(argValue(argv, '--seed'));
  if (!Number.isInteger(seed)) throw new Error('--seed <n> 이 필요하다');
  if (argv.includes('--report')) {
    const size = Number(argValue(argv, '--size'));
    const samples = Number(argValue(argv, '--samples') ?? '300');
    if (!Number.isInteger(size) || !Number.isInteger(samples)) {
      throw new Error('사용법: generate.ts --report --size <n> [--samples <n>] --seed <n>');
    }
    return { mode: 'report', seed, levels: [], out: null, size, samples };
  }
  const lvRaw = argValue(argv, '--level');
  const levels = lvRaw === 'all' ? known : [Number(lvRaw)];
  if (levels.some((n) => !known.includes(n))) {
    throw new Error(`사용법: generate.ts --seed <n> --level <${known.join('|')}|all> [--out <file>]`);
  }
  return { mode: 'generate', seed, levels, out: argValue(argv, '--out') ?? null, size: 0, samples: 0 };
}

export function renderModule(levels: GeneratedLevel[], seed: number, infos: PoolInfo[]): string {
  const lines = [
    `// 생성 산출물. 직접 수정 금지 — pnpm exec tsx tools/generate.ts --seed ${seed} --level all 로 재생성한다.`,
    `// 개수: ${levels.length}`,
    `// 가중치: ${WEIGHTS.version}`,
    `// 밴드: ${JSON.stringify(LEVEL_CONFIGS)}`,
    ...infos.map((i) => `// 레벨 ${i.level}: 풀 ${i.pool}, 점수 ${i.scoreMin}~${i.scoreMax}`),
    `import type { GeneratedLevel } from '../../sudoku/model/levels';`,
    `export const LEVELS: GeneratedLevel[] = ${JSON.stringify(levels)};`,
    ``,
  ];
  return lines.join('\n');
}

export interface RunResult {
  levels: GeneratedLevel[];
  infos: PoolInfo[];
  failures: number[];
  elapsedMs: number;
}

export function runLevels(seed: number, levels: number[]): RunResult {
  const started = Date.now();
  const out: GeneratedLevel[] = [];
  const infos: PoolInfo[] = [];
  const failures: number[] = [];
  for (const level of levels) {
    const t = Date.now();
    try {
      const r = generateLevel(level, seed);
      out.push(...r.levels);
      infos.push(r.info);
      console.error(
        `레벨 ${level}: 풀 ${r.info.pool}, 점수 ${r.info.scoreMin}~${r.info.scoreMax}, ${(Date.now() - t) / 1000}s`,
      );
    } catch (e) {
      console.error(`레벨 ${level} 실패: ${(e as Error).message}`);
      failures.push(level);
    }
  }
  const elapsedMs = Date.now() - started;
  console.error(`생성 ${out.length}개, 소요 ${elapsedMs / 1000}s`);
  return { levels: out, infos, failures, elapsedMs };
}

function printReport(size: number, samples: number, seed: number): void {
  const started = Date.now();
  const { summary, rows } = report(size, samples, seed);
  const fmt = (q: Quantiles) => Q.map((p) => `p${p}=${q[p]}`).join(' ');
  console.log(
    `크기 ${size}, 표본 ${rows.length}, 시드 ${seed}, 가중치 ${WEIGHTS.version}, ${(Date.now() - started) / 1000}s`,
  );
  console.log(`tier: ${JSON.stringify(summary.tiers)}`);
  console.log(`t1: ${fmt(summary.t1)}`);
  console.log(`t2: ${fmt(summary.t2)}`);
  console.log(`t3: ${fmt(summary.t3)}`);
  console.log(`maxChain: ${fmt(summary.maxChain)}`);
  console.log(`score: ${fmt(summary.score)}`);
  console.log(`singles: ${JSON.stringify(summary.singles)}`);
  const byTier = (t: number) => rows.filter((r) => r.tier === t).map((r) => r.score).sort((a, b) => a - b);
  for (const t of [1, 2, 3]) {
    const v = byTier(t);
    if (v.length > 0) console.log(`tier ${t} score: n=${v.length} ${fmt(quantiles(v))}`);
  }
}

const invoked = process.argv[1]?.endsWith('generate.ts');
if (invoked) {
  const args = parseArgs(process.argv);
  if (args.mode === 'report') {
    printReport(args.size, args.samples, args.seed);
  } else {
    const { levels: all, infos, failures } = runLevels(args.seed, args.levels);
    if (args.out) {
      fs.writeFileSync(args.out, renderModule(all, args.seed, infos));
    } else {
      console.log(JSON.stringify(all));
    }
    if (failures.length > 0) process.exitCode = 1;
  }
}
