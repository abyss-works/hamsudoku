import { generateEndlessPool } from '../../tools/generate';
import { serializeRegions, serializeSolution, stageId } from '../shared/endlessStageFormat';
import type { DbPort, EndlessStageRow } from './db';
import { checkIslands, countSolutions, type Pos } from '../features/sudoku/model/solver';
import { measure } from '../features/sudoku/model/logic';
import { scoreDifficulty } from '../features/sudoku/model/shape';
import { countSingles, ENDLESS_BAND, inBand } from '../features/sudoku/model/levels';

export const LEASE_DURATION_MS = 120_000;

export interface ChunkExecutionResult {
  ok: boolean;
  stageCount?: number;
  alreadyCompleted?: boolean;
  reason?: string;
  jobId?: string;
  chunkIndex?: number;
}

export interface EndlessCandidate {
  islands: number[][];
  solution: Pos[];
  tier: number;
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
    if (r < 0 || r >= 7 || c < 0 || c >= 7) return false;
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
  // 5. 난이도 band 검증
  const m = measure(candidate.islands);
  const sh = { ...scoreDifficulty(candidate.islands), singles: countSingles(candidate.islands) };
  if (!inBand(m, sh, ENDLESS_BAND)) {
    return false;
  }
  return true;
}

export async function executeSupplyChunk(
  db: DbPort,
  params: { jobId: string; chunkIndex: number },
  nowIso: string = new Date().toISOString(),
): Promise<ChunkExecutionResult> {
  // 1. 원자적 claim 및 임대 획득 (만료 lease 회복 포함)
  const claim = await db.claimSupplyChunk(params.jobId, params.chunkIndex, nowIso, LEASE_DURATION_MS);

  if (!claim.claimed) {
    if (claim.alreadyCompleted) {
      return {
        ok: true,
        alreadyCompleted: true,
        stageCount: claim.stageCount,
        jobId: params.jobId,
        chunkIndex: params.chunkIndex,
      };
    }
    return {
      ok: false,
      reason: claim.reason ?? 'CLAIM_BUSY',
      jobId: params.jobId,
      chunkIndex: params.chunkIndex,
    };
  }

  const seed = (claim.seedStart ?? 10000) + params.chunkIndex;
  const targetCount = claim.targetCount ?? 10;

  try {
    // 2. CPU 퍼즐 생성 (DB 트랜잭션 밖에서 실행)
    const rawCandidates = generateEndlessPool(seed, targetCount);
    if (rawCandidates.length < targetCount) {
      await db.failSupplyChunk(params.jobId, params.chunkIndex, 'TARGET_COUNT_UNMET');
      return { ok: false, reason: 'TARGET_COUNT_UNMET' };
    }

    // 3. 7x7/영역/해답/유일성/기존band 규칙 검증
    const validatedCandidates: EndlessCandidate[] = [];
    for (const cand of rawCandidates) {
      if (validateEndlessCandidate(cand)) {
        validatedCandidates.push(cand);
      }
    }

    if (validatedCandidates.length < targetCount) {
      await db.failSupplyChunk(params.jobId, params.chunkIndex, 'VALIDATION_FAILED');
      return { ok: false, reason: 'VALIDATION_FAILED' };
    }

    // 4. 스테이지 행 구성
    const stageRows: EndlessStageRow[] = validatedCandidates.slice(0, targetCount).map((c, i) => ({
      id: stageId(seed, i),
      size: c.islands.length,
      regions: serializeRegions(c.islands),
      solution: serializeSolution(c.solution),
      tier: c.tier,
      seed,
      plays: 0,
      clears: 0,
      avgClearMs: 0,
      clearTotalMs: BigInt(0),
    }));

    // 5. 단일 DB 트랜잭션 적재 및 완료 상태 갱신 (실제 성공 시각은 DB 적재 완료 시각)
    const commitTimeIso = new Date().toISOString();
    const success = await db.insertSupplyBatch(params.jobId, params.chunkIndex, stageRows, commitTimeIso);
    if (!success) {
      await db.failSupplyChunk(params.jobId, params.chunkIndex, 'CONTENT_DUPLICATE_OR_TARGET_UNMET');
      return { ok: false, reason: 'CONTENT_DUPLICATE_OR_TARGET_UNMET' };
    }

    return {
      ok: true,
      stageCount: stageRows.length,
      jobId: params.jobId,
      chunkIndex: params.chunkIndex,
    };
  } catch (err) {
    await db.failSupplyChunk(params.jobId, params.chunkIndex, 'EXCEPTION_OCCURRED');
    throw err;
  }
}
