import type { MyRankResponse, RankResponse } from '../../shared/endless';
import { mergeRankEntries } from '../../shared/rankMerge';

export function rankModel(rank: RankResponse | null, myRank: MyRankResponse | null | undefined, uid: string | null, signedIn: boolean) {
  const live = myRank ? { score: myRank.score, nickname: myRank.nickname } : undefined;
  const merged = rank && uid && signedIn ? mergeRankEntries(rank, uid, live) : null;
  const entries = merged?.entries ?? rank?.top ?? [];
  const myScore = myRank?.score ?? rank?.me.score ?? 0;
  const fallbackNo = rank?.me.rank ?? null;
  const myRankNo = myRank ? myRank.rank : fallbackNo === null ? null : (merged?.meRank ?? fallbackNo);
  return { entries, myScore, myRankNo };
}
