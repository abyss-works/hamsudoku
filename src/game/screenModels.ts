import type { Chapter } from '../api/stagesApi';
import type { ClearEntry } from './save';
import type { MyRankResponse, RankResponse } from '../shared/endless';
import { mergeRankEntries } from '../shared/rankMerge';
export function homeGate(enabled: boolean, uid: string | null, email: string | null, nickname: string | null) {
  if (enabled && uid !== null && email === null)
    return 'guest';
  if (enabled && email !== null && !nickname)
    return 'nickname';
  return 'enter';
}
function elapsed(sec: number) { return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }
export function selectionModel(chapters: Chapter[], selectedId: string | null, clears: Map<string, ClearEntry>) {
  const active = chapters.find(c => c.id === selectedId) ?? chapters[0];
  const stages = (active?.stages ?? []).map((stage, i) => {
    const entry = clears.get(stage.code);
    const best = entry ? elapsed(entry.elapsedSec) : '-';
    return { stage, number: i + 1, best, label: entry ? `${i + 1}, 베스트 ${best}` : String(i + 1) };
  });
  return { active, stages };
}
export function rankModel(rank: RankResponse | null, myRank: MyRankResponse | null | undefined, uid: string | null, signedIn: boolean) {
  const live = myRank ? { score: myRank.score, nickname: myRank.nickname } : undefined;
  const merged = rank && uid && signedIn ? mergeRankEntries(rank, uid, live) : null;
  const entries = merged?.entries ?? rank?.top ?? [];
  const myScore = myRank?.score ?? rank?.me.score ?? 0;
  const fallbackNo = rank?.me.rank ?? null;
  const myRankNo = myRank ? myRank.rank : fallbackNo === null ? null : (merged?.meRank ?? fallbackNo);
  return { entries, myScore, myRankNo };
}
