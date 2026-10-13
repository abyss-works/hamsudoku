import { countSingles, ENDLESS_BAND, inBand } from './difficulty';
import { measure } from './logic';
import type { Pos } from './solver';
import { checkIslands, countSolutions } from './solver';
import { scoreDifficulty } from './shape';
import { MAX_ATTEMPTS, mulberry32, sampleCandidate } from './candidateGenerator';

export interface EndlessCandidate {
  islands: number[][];
  solution: Pos[];
  tier: number;
}

export function generateEndlessPool(seed: number, target: number): EndlessCandidate[] {
  const rand = mulberry32(seed + 1000);
  const out: EndlessCandidate[] = [];
  const seen = new Set<string>();
  for (let attempt = 0; attempt < MAX_ATTEMPTS * 20 && out.length < target; attempt += 1) {
    const cand = sampleCandidate(ENDLESS_BAND.size, rand);
    if (!cand) continue;
    const key = JSON.stringify(cand.islands);
    if (seen.has(key)) continue;
    if (!inBand(cand.m, cand.sh, ENDLESS_BAND)) continue;
    seen.add(key);
    out.push({ islands: cand.islands, solution: cand.solution, tier: cand.m.tier });
  }
  return out;
}

export function validateEndlessCandidate(candidate: EndlessCandidate): boolean {
  // 1. 7x7 크기 검증
  if (!candidate.islands || candidate.islands.length !== 7 || candidate.islands.some((r) => r.length !== 7)) {
    return false;
  }
  // 2. 7개 영역 및 영역 연결성 검증
  const islandIds = new Set(candidate.islands.flat());
  if (islandIds.size !== 7 || checkIslands(candidate.islands).length > 0) {
    return false;
  }
  // 3. 7개 해답 좌표 검증 (행당 1개, 열당 1개, 영역당 1개)
  if (!candidate.solution || candidate.solution.length !== 7) {
    return false;
  }
  const rows = new Set<number>();
  const cols = new Set<number>();
  const islands = new Set<number>();
  for (const [r, c] of candidate.solution) {
    if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || r >= 7 || c < 0 || c >= 7) return false;
    rows.add(r);
    cols.add(c);
    islands.add(candidate.islands[r][c]);
  }
  if (rows.size !== 7 || cols.size !== 7 || islands.size !== 7) {
    return false;
  }
  // 4. 유일 해답 검증 (해답이 정확히 1개)
  const solutions = countSolutions(candidate.islands, 2);
  if (solutions.length !== 1) {
    return false;
  }
  const coordinates = (spots: Pos[]) => spots.map(([r, c]) => `${r},${c}`).sort().join(';');
  if (coordinates(candidate.solution) !== coordinates(solutions[0])) return false;
  // 5. 난이도 band 검증
  const m = measure(candidate.islands);
  const sh = { ...scoreDifficulty(candidate.islands), singles: countSingles(candidate.islands) };
  if (!inBand(m, sh, ENDLESS_BAND)) {
    return false;
  }
  return true;
}
