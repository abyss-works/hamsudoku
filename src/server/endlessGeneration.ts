import {
  generateEndlessPool,
  validateEndlessCandidate,
  type EndlessCandidate,
} from '../shared/sudoku/endlessPoolGenerator';
import { serializeRegions, serializeSolution, stageId } from '../shared/endlessStageFormat';
import type { DbPort, EndlessStageRow } from './db';

export const LEASE_DURATION_MS = 120_000;

export interface ChunkExecutionResult {
  ok: boolean;
  stageCount?: number;
  alreadyCompleted?: boolean;
  reason?: string;
  jobId?: string;
  chunkIndex?: number;
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

  const claimToken = claim.claimToken;
  const seed = (claim.seedStart ?? 10000) + params.chunkIndex;
  const targetCount = claim.targetCount ?? 10;

  try {
    // 2. CPU 퍼즐 생성 (DB 트랜잭션 밖에서 실행)
    const rawCandidates = generateEndlessPool(seed, targetCount);
    if (rawCandidates.length < targetCount) {
      await db.failSupplyChunk(params.jobId, params.chunkIndex, 'TARGET_COUNT_UNMET', claimToken);
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
      await db.failSupplyChunk(params.jobId, params.chunkIndex, 'VALIDATION_FAILED', claimToken);
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
    const success = await db.insertSupplyBatch(params.jobId, params.chunkIndex, stageRows, commitTimeIso, claimToken);
    if (!success) {
      await db.failSupplyChunk(params.jobId, params.chunkIndex, 'CONTENT_DUPLICATE_OR_TARGET_UNMET', claimToken);
      return { ok: false, reason: 'CONTENT_DUPLICATE_OR_TARGET_UNMET' };
    }

    return {
      ok: true,
      stageCount: stageRows.length,
      jobId: params.jobId,
      chunkIndex: params.chunkIndex,
    };
  } catch (err) {
    await db.failSupplyChunk(params.jobId, params.chunkIndex, 'EXCEPTION_OCCURRED', claimToken);
    throw err;
  }
}
