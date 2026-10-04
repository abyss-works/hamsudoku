import fs from 'node:fs';
import type { Puzzle } from '../src/game/puzzles';
import type { Pos } from '../src/game/solver';
import { checkIslands, countSolutions } from '../src/game/solver';
import { scoreDifficulty } from '../src/game/shape';

export interface GeneratedLevel {
  level: number;
  no: number;
  code: string;
  puzzle: Puzzle;
}

interface LevelConfig {
  size: number;
  count: number;
  minStraight: number;
  maxStraight: number;
}

const CONFIGS: Record<number, LevelConfig> = {
  1: { size: 5, count: 10, minStraight: 0.6, maxStraight: 1 },
  2: { size: 6, count: 10, minStraight: 0.3, maxStraight: 0.6 },
  3: { size: 7, count: 10, minStraight: 0, maxStraight: 1 },
};

const DIRS: Pos[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function adjacent(a: Pos, b: Pos): boolean {
  return Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1;
}

function samplePlacement(size: number, rand: () => number): Pos[] {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const cols = [...Array(size).keys()];
    for (let i = cols.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [cols[i], cols[j]] = [cols[j], cols[i]];
    }
    const spots: Pos[] = cols.map((c, r) => [r, c]);
    if (spots.every((a, i) => spots.every((b, j) => i >= j || !adjacent(a, b)))) return spots;
  }
  throw new Error(`정답 배치를 뽑지 못했다 (size ${size})`);
}

function growIslands(size: number, spots: Pos[], rand: () => number): number[][] {
  const islands: number[][] = Array.from({ length: size }, () => Array(size).fill(-1));
  spots.forEach(([r, c], id) => {
    islands[r][c] = id;
  });
  let remaining = size * size - size;
  while (remaining > 0) {
    const options: { r: number; c: number; id: number }[] = [];
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (islands[r][c] !== -1) continue;
        for (const [dr, dc] of DIRS) {
          const id = islands[r + dr]?.[c + dc];
          if (id !== undefined && id !== -1) options.push({ r, c, id });
        }
      }
    }
    if (options.length === 0) throw new Error('섬 성장 막힘 (연속 불가)');
    const pick = options[Math.floor(rand() * options.length)];
    islands[pick.r][pick.c] = pick.id;
    remaining -= 1;
  }
  return islands;
}

function lockedKeys(spots: Pos[]): Set<string> {
  return new Set(spots.map(([r, c]) => `${r},${c}`));
}

function tryMove(map: number[][], locked: Set<string>, rand: () => number): number[][] | null {
  const size = map.length;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const r = Math.floor(rand() * size);
    const c = Math.floor(rand() * size);
    if (locked.has(`${r},${c}`)) continue;
    const [dr, dc] = DIRS[Math.floor(rand() * DIRS.length)];
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
    if (map[nr][nc] === map[r][c]) continue;
    const next = map.map((line) => [...line]);
    next[r][c] = map[nr][nc];
    if (checkIslands(next).length > 0) continue;
    return next;
  }
  return null;
}

function uniquify(islands: number[][], spots: Pos[], rand: () => number): number[][] | null {
  const locked = lockedKeys(spots);
  let best = islands.map((line) => [...line]);
  let bestCount = countSolutions(best, 4).length;
  for (let cycle = 0; cycle < 40 && bestCount > 1; cycle += 1) {
    for (let iter = 0; iter < 1500 && bestCount > 1; iter += 1) {
      const next = tryMove(best, locked, rand);
      if (!next) continue;
      const n = countSolutions(next, bestCount + 1).length;
      if (n <= bestCount) {
        best = next;
        bestCount = n;
      }
    }
    for (let k = 0; k < 12; k += 1) {
      const next = tryMove(best, locked, rand);
      if (next) best = next;
    }
    bestCount = countSolutions(best, 4).length;
  }
  return bestCount === 1 ? best : null;
}

function inBand(islands: number[][], cfg: LevelConfig): boolean {
  const s = scoreDifficulty(islands);
  return s.straightRatio >= cfg.minStraight && s.straightRatio <= cfg.maxStraight;
}

export function generateLevels(level: number, seed: number): GeneratedLevel[] {
  const cfg = CONFIGS[level];
  if (!cfg) throw new Error(`알 수 없는 레벨: ${level}`);
  const rand = mulberry32(seed);
  const out: GeneratedLevel[] = [];
  for (let no = 1; no <= cfg.count; no += 1) {
    let accepted: number[][] | null = null;
    let solution: Pos[] = [];
    for (let attempt = 0; attempt < 200 && !accepted; attempt += 1) {
      const spots = samplePlacement(cfg.size, rand);
      const grown = growIslands(cfg.size, spots, rand);
      const unique = uniquify(grown, spots, rand);
      if (unique && inBand(unique, cfg)) {
        accepted = unique;
        solution = spots;
      }
    }
    if (!accepted) throw new Error(`레벨 ${level} ${no}번 후보 채택 실패 (200회 초과)`);
    out.push({
      level,
      no,
      code: `${level}-${no}`,
      puzzle: { name: '', size: cfg.size, islands: accepted, solution },
    });
  }
  return out;
}

function parseArgs(argv: string[]): { seed: number; levels: number[]; out: string | null } {
  const seed = Number(argv[argv.indexOf('--seed') + 1]);
  const lvRaw = argv[argv.indexOf('--level') + 1];
  const levels = lvRaw === 'all' ? [1, 2, 3] : [Number(lvRaw)];
  const outIdx = argv.indexOf('--out');
  if (!Number.isInteger(seed) || levels.some((n) => ![1, 2, 3].includes(n))) {
    throw new Error('사용법: generate.ts --seed <n> --level <1|2|3|all> [--out <file>]');
  }
  return { seed, levels, out: outIdx >= 0 ? argv[outIdx + 1] : null };
}

export function renderModule(levels: GeneratedLevel[], seed: number): string {
  const lines = [
    `// 생성 산출물. 직접 수정 금지 — npx tsx tools/generate.ts --seed ${seed} 로 재생성한다.`,
    `// 일시: ${new Date().toISOString()}, 개수: ${levels.length}`,
    `import type { Puzzle } from './puzzles';`,
    ``,
    `export interface GeneratedLevel {`,
    `  level: number;`,
    `  no: number;`,
    `  code: string;`,
    `  puzzle: Puzzle;`,
    `}`,
    ``,
    `export const LEVELS: GeneratedLevel[] = ${JSON.stringify(levels)};`,
    ``,
  ];
  return lines.join('\n');
}

const invoked = process.argv[1]?.endsWith('generate.ts');
if (invoked) {
  const { seed, levels, out } = parseArgs(process.argv);
  const started = Date.now();
  const all = levels.flatMap((level) => generateLevels(level, seed));
  console.error(`생성 ${all.length}개, 소요 ${(Date.now() - started) / 1000}s`);
  if (out) {
    fs.writeFileSync(out, renderModule(all, seed));
  } else {
    console.log(JSON.stringify(all));
  }
}
