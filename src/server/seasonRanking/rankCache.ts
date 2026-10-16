import { rankingFrozen } from '../../shared/season';
import type { Defer } from '../defer';
import { rankStoreFromEnv } from '../rank';

/**
 * Redis 순위 표시 캐시에 적립을 응답 뒤에 더한다. 집계 마감 창에는 더하지 않는다.
 * 표시 캐시는 원장에서 주기적으로 다시 만들어지므로 가산 실패는 무시한다.
 */
export function deferRankEarning(defer: Defer, input: { season: string; userId: string; amount: number; at: Date }): void {
  if (rankingFrozen(input.at)) return;
  const store = rankStoreFromEnv();
  if (!store) return;
  defer(async () => {
    await store.increment(input.season, input.userId, input.amount).catch(() => {});
  });
}
