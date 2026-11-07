import { withTransaction } from '../db/client';
import { reserveSupplyJob, type SupplyDecision, type SupplyPolicy } from './store';

export const SUPPLY_POLICY: SupplyPolicy = {
  stockThreshold: 20,
  cooldownMs: 60_000,
  leaseDurationMs: 120_000,
  batchCount: 10,
};

/**
 * 판 재고를 판정해 필요하면 공급 작업을 대기 상태로 예약한다. 예약은 공급 잠금 트랜잭션 안에서 수행하며
 * 생성은 하지 않는다. 대기 작업은 주기적으로 호출되는 생성 엔드포인트가 점유해 처리한다.
 */
export function requestSupply(now: Date): Promise<SupplyDecision> {
  return withTransaction((tx) => reserveSupplyJob(tx, now, SUPPLY_POLICY));
}
