import { generateEndlessPool } from '../../tools/generate';
import { serializeRegions, serializeSolution, stageId } from '../../tools/load-pool';
import type { DbPort } from './db';

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
  const job = await db.findSupplyJob(params.jobId);
  const chunk = await db.findSupplyChunk(params.jobId, params.chunkIndex);

  if (!job || !chunk) {
    return { ok: false, reason: 'JOB_OR_CHUNK_NOT_FOUND' };
  }

  // 멱등성: 이미 완료된 청크는 재생성하지 않고 즉시 성공 반환
  if (chunk.status === 'completed') {
    return {
      ok: true,
      alreadyCompleted: true,
      stageCount: chunk.stageCount,
      jobId: params.jobId,
      chunkIndex: params.chunkIndex,
    };
  }

  // 청크와 작업 상태를 running으로 갱신
  await db.updateSupplyChunk(params.jobId, params.chunkIndex, { status: 'running' });
  await db.updateSupplyJob(params.jobId, { status: 'running' });

  const seed = job.seedStart + params.chunkIndex;
  const targetCount = job.targetCount;

  // 10개 퍼즐 생성
  const candidates = generateEndlessPool(seed, targetCount);

  if (candidates.length < targetCount) {
    await db.updateSupplyChunk(params.jobId, params.chunkIndex, { status: 'failed' });
    await db.updateSupplyJob(params.jobId, { status: 'failed' });
    return { ok: false, reason: 'TARGET_COUNT_UNMET' };
  }

  // 원자적 퍼즐 삽입
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const id = stageId(seed, i);
    const existing = await db.getStage(id);
    if (!existing) {
      await db.insertStage({
        id,
        size: c.islands.length,
        regions: serializeRegions(c.islands),
        solution: serializeSolution(c.solution),
        tier: c.tier,
        seed,
        plays: 0,
        clears: 0,
        avgClearMs: 0,
        clearTotalMs: BigInt(0),
      });
    }
  }

  // 청크 및 작업 완료 갱신 (lastSuccessAt 갱신)
  await db.updateSupplyChunk(params.jobId, params.chunkIndex, {
    status: 'completed',
    stageCount: candidates.length,
    completedAt: nowIso,
  });

  await db.updateSupplyJob(params.jobId, {
    status: 'completed',
    lastSuccessAt: nowIso,
  });

  return {
    ok: true,
    stageCount: candidates.length,
    jobId: params.jobId,
    chunkIndex: params.chunkIndex,
  };
}
