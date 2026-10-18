import { rankingFrozen, seasonWindow } from '../../shared/season';
import { db } from '../db/client';
import { deferTask, type Defer } from '../defer';
import { rankStoreFromEnv, type RankStore } from '../rank';
import { listSeasonEarnings } from './queries';

/**
 * Redis 순위 표시 캐시에 적립을 응답 뒤에 더한다. 집계 마감 창에는 더하지 않는다.
 * 표시 캐시는 원장에서 주기적으로 다시 만들어지므로 가산 실패는 무시한다.
 */
export function deferRankEarning(defer: Defer, input: { season: string; userId: string; amount: number; at: Date }): void {
  if (rankingFrozen(input.at)) return;
  const store = rankStoreFromEnv();
  if (!store) return;
  deferTask(defer, {
    name: 'rank-earning',
    task: () => store.increment(input.season, input.userId, input.amount),
    onError: () => {},
  });
}

/** 시즌 원장의 랭킹 대상 합계로 순위 저장소의 사용자 점수를 다시 쓴다. 기록한 사용자 수를 반환한다. */
export async function rebuildRankCache(store: RankStore, season: string): Promise<number> {
  const rows = await listSeasonEarnings(db, season, seasonWindow(season));
  for (const row of rows) await store.setScore(season, row.userId, row.amount);
  return rows.length;
}
