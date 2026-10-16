import { db, withTransaction } from '../db/client';
import { markSupplyJobPublishFailed, reserveSupplyJob, type SupplyDecision, type SupplyPolicy } from './store';

export const SUPPLY_POLICY: SupplyPolicy = {
  stockThreshold: 20,
  cooldownMs: 60_000,
  leaseDurationMs: 120_000,
  batchCount: 10,
};

export interface SupplyEnqueuer {
  enqueueChunk(jobId: string, chunkIndex: number): Promise<void>;
}

/**
 * 판 재고를 판정해 필요하면 공급 작업을 예약하고 생성 요청을 발행한다. 예약은 공급 잠금 트랜잭션 안에서,
 * 외부 발행은 트랜잭션 밖에서 수행한다. 발행이 실패하면 작업을 publish_failed로 기록해 다음 요청이 다시 예약할 수 있게 한다.
 */
export async function requestSupply(now: Date, enqueuer?: SupplyEnqueuer): Promise<SupplyDecision & { enqueueError?: string }> {
  const decision = await withTransaction((tx) => reserveSupplyJob(tx, now, SUPPLY_POLICY));
  if (!decision.shouldEnqueue || !decision.jobId || !enqueuer) return decision;
  try {
    await enqueuer.enqueueChunk(decision.jobId, 0);
  } catch (error) {
    await markSupplyJobPublishFailed(db, decision.jobId, now);
    return { ...decision, enqueueError: (error as Error).message };
  }
  return decision;
}
