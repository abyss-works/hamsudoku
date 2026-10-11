import type { DbPort, EndlessSupplyJobRow } from './db';

export const STOCK_THRESHOLD = 20;
export const BATCH_COUNT = 10;
export const COOLDOWN_MS = 60_000;
export const LEASE_DURATION_MS = 120_000;
export const POLICY_VERSION = 'v1';

export type { EndlessSupplyJobRow, EndlessSupplyChunkRow } from './db';

export interface SupplyDecision {
  shouldEnqueue: boolean;
  action: 'enqueued' | 'merged' | 'cooldown' | 'sufficient_stock';
  jobId?: string;
}

export function evaluateSupplyDecision(params: {
  stockCount: number;
  activeJob: EndlessSupplyJobRow | null;
  lastSuccessAt: string | null;
  nowIso: string;
}): SupplyDecision {
  // 1. 재고 20개 이상이면 보충 작업을 만들지 않는다 (20개 경계)
  if (params.stockCount >= STOCK_THRESHOLD) {
    return { shouldEnqueue: false, action: 'sufficient_stock' };
  }

  // 2. 이미 활성 작업이 있으면 합침 (60초 경과 여부 무관)
  if (params.activeJob) {
    return { shouldEnqueue: false, action: 'merged', jobId: params.activeJob.id };
  }

  // 3. 최근 DB 적재 성공 후 60초 신규 큐잉 억제 (쿨다운 경계: 59초는 억제, 60초는 허용)
  if (params.lastSuccessAt) {
    const elapsed = Date.parse(params.nowIso) - Date.parse(params.lastSuccessAt);
    if (elapsed < COOLDOWN_MS) {
      return { shouldEnqueue: false, action: 'cooldown' };
    }
  }

  // 4. 재고 부족(<20), 활성 작업 없음, 쿨다운 경과 -> 큐잉 허용
  return { shouldEnqueue: true, action: 'enqueued' };
}

export async function requestSupply(
  db: DbPort,
  nowIso: string,
  enqueuer?: { enqueueChunk: (jobId: string, chunkIndex: number) => Promise<void> },
): Promise<SupplyDecision> {
  const stockCount = await db.countZeroClearStages();
  const activeJob = await db.findActiveSupplyJob(nowIso);
  const lastSuccessAt = await db.getLatestSupplySuccessAt();

  const decision = evaluateSupplyDecision({
    stockCount,
    activeJob,
    lastSuccessAt,
    nowIso,
  });

  if (!decision.shouldEnqueue) {
    return decision;
  }

  const highestSeed = await db.getHighestStageSeed();
  const seedStart = highestSeed + 1;
  const seedEnd = seedStart + BATCH_COUNT;
  const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const leaseExpiresAt = new Date(Date.parse(nowIso) + LEASE_DURATION_MS).toISOString();

  await db.createSupplyJob({
    id: jobId,
    policyVersion: POLICY_VERSION,
    seedStart,
    seedEnd,
    targetCount: BATCH_COUNT,
    leaseExpiresAt,
  });

  await db.createSupplyChunk({
    id: `${jobId}:0`,
    jobId,
    chunkIndex: 0,
    status: 'pending',
  });

  if (enqueuer) {
    await enqueuer.enqueueChunk(jobId, 0);
  }

  return { shouldEnqueue: true, action: 'enqueued', jobId };
}
