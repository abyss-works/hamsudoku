import { serializeRegions, serializeSolution, stageId } from '../../shared/endlessStageFormat';
import { generateEndlessPool, validateEndlessCandidate } from '../../shared/sudoku/endlessPoolGenerator';
import { withTransaction } from '../db/client';
import { claimSupplyChunk, failSupplyChunk, insertSupplyBatch, type SupplyStageRow } from './store';
import { SUPPLY_POLICY } from './supply';

export interface ChunkExecutionResult {
  ok: boolean;
  stageCount?: number;
  alreadyCompleted?: boolean;
  reason?: string;
  jobId?: string;
  chunkIndex?: number;
}

/**
 * 공급 청크를 점유해 퍼즐을 생성·검증하고 한 트랜잭션으로 적재한다. 퍼즐 생성은 트랜잭션 밖에서 수행하고,
 * 실패는 점유 토큰으로 기록해 만료된 이전 실행자가 새 실행자의 상태를 덮어쓰지 못하게 한다.
 */
export async function executeSupplyChunk(
  params: { jobId: string; chunkIndex: number },
  nowIso: string = new Date().toISOString(),
): Promise<ChunkExecutionResult> {
  const { jobId, chunkIndex } = params;
  const claim = await withTransaction((tx) =>
    claimSupplyChunk(tx, { jobId, chunkIndex, now: new Date(nowIso), leaseDurationMs: SUPPLY_POLICY.leaseDurationMs }),
  );
  if (!claim.claimed) {
    if (claim.alreadyCompleted) return { ok: true, alreadyCompleted: true, stageCount: claim.stageCount, jobId, chunkIndex };
    return { ok: false, reason: claim.reason, jobId, chunkIndex };
  }

  const { claimToken } = claim;
  const fail = () => withTransaction((tx) => failSupplyChunk(tx, { jobId, chunkIndex, now: new Date(), claimToken }));
  const seed = claim.seedStart + chunkIndex;
  const targetCount = claim.targetCount;

  try {
    const candidates = generateEndlessPool(seed, targetCount);
    if (candidates.length < targetCount) {
      await fail();
      return { ok: false, reason: 'TARGET_COUNT_UNMET' };
    }
    const validated = candidates.filter((candidate) => validateEndlessCandidate(candidate));
    if (validated.length < targetCount) {
      await fail();
      return { ok: false, reason: 'VALIDATION_FAILED' };
    }

    const rows: SupplyStageRow[] = validated.slice(0, targetCount).map((candidate, index) => ({
      id: stageId(seed, index),
      size: candidate.islands.length,
      regions: serializeRegions(candidate.islands),
      solution: serializeSolution(candidate.solution),
      tier: candidate.tier,
      seed,
    }));
    // 실제 성공 시각은 DB 적재 시각이다.
    const inserted = await withTransaction((tx) =>
      insertSupplyBatch(tx, { jobId, chunkIndex, rows, completedAt: new Date(), claimToken }),
    );
    if (!inserted) {
      await fail();
      return { ok: false, reason: 'CONTENT_DUPLICATE_OR_TARGET_UNMET' };
    }
    return { ok: true, stageCount: rows.length, jobId, chunkIndex };
  } catch (error) {
    await fail();
    throw error;
  }
}
