import { countSingles, type ShapeInfo } from './difficulty';
import { measure, type Measure } from './logic';
import type { Pos } from './solver';
import { checkIslands, countSolutions } from './solver';
import { scoreDifficulty } from './shape';

const DIRS: Pos[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export const MAX_ATTEMPTS = 5000;

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

/** 경계 hill-climb 로 해를 1개로 줄인다. 해가 1개가 되면 즉시 반환한다. */
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
    if (bestCount === 1) return best;
    for (let k = 0; k < 12; k += 1) {
      const next = tryMove(best, locked, rand);
      if (next) best = next;
    }
    bestCount = countSolutions(best, 4).length;
  }
  return bestCount === 1 ? best : null;
}

function shapeOf(islands: number[][]): ShapeInfo {
  return { ...scoreDifficulty(islands), singles: countSingles(islands) };
}

export interface Candidate {
  islands: number[][];
  solution: Pos[];
  m: Measure;
  sh: ShapeInfo;
}

/** 유일해까지 통과한 후보를 하나 만든다. 유일화에 실패하면 null. */
export function sampleCandidate(size: number, rand: () => number): Candidate | null {
  const spots = samplePlacement(size, rand);
  const grown = growIslands(size, spots, rand);
  const unique = uniquify(grown, spots, rand);
  if (!unique) return null;
  return { islands: unique, solution: spots, m: measure(unique), sh: shapeOf(unique) };
}
