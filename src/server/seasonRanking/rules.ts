import { rankingFrozen, seasonWindow } from '../../shared/season';

/**
 * 적립 시각이 해당 시즌 집계 구간 안이고 집계 마감 창 밖이면 랭킹 대상이다.
 * 시즌 확정 여부는 저장소가 적립과 같은 문장에서 판정한다.
 */
export function countsForRanking(season: string, at: Date): boolean {
  const range = seasonWindow(season);
  const atMs = at.getTime();
  return atMs >= range.startAt.getTime() && atMs < range.endAt.getTime() && !rankingFrozen(at);
}
