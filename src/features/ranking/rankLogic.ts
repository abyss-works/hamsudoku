import type { MyRankResponse, RankEntry, RankResponse } from '../../shared/endless';
import { mergeRankEntries } from '../../shared/rankMerge';

export interface RankRowModel {
  userId: string;
  rankNo: number;
  displayName: string;
  score: number;
  isMe: boolean;
}

export function rankModel(
  rank: RankResponse | null,
  myRank: MyRankResponse | null | undefined,
  uid: string | null,
  signedIn: boolean,
) {
  const live = myRank ? { score: myRank.score, nickname: myRank.nickname } : undefined;
  const merged = rank && uid && signedIn ? mergeRankEntries(rank, uid, live) : null;
  const entries = merged?.entries ?? rank?.top ?? [];
  const myScore = myRank?.score ?? rank?.me.score ?? 0;
  const fallbackNo = rank?.me.rank ?? null;
  const myRankNo = myRank ? myRank.rank : fallbackNo === null ? null : (merged?.meRank ?? fallbackNo);

  const season = rank?.season ?? null;
  const frozen = Boolean(rank?.frozen);
  const rows: RankRowModel[] = entries.map((e, i) => ({
    userId: e.userId,
    rankNo: i + 1,
    displayName: e.nickname ?? '게스트',
    score: e.score,
    isMe: e.userId === uid,
  }));
  const empty = Boolean(rank && entries.length === 0);

  let myRankSummary: string | null = null;
  if (rank && signedIn) {
    myRankSummary = `내 순위: ${myRankNo === null ? '아직 없음' : `${myRankNo}위`} · ${myScore}개`;
  }

  return {
    entries,
    myScore,
    myRankNo,
    season,
    frozen,
    rows,
    empty,
    myRankSummary,
  };
}

export function adminRankModel(
  entries: RankEntry[],
  guestEntries: RankEntry[],
  selected: string[],
) {
  const summaryText = `전체 ${entries.length}건 · 게스트 ${guestEntries.length}건 — 게스트만 기본 목록이에요.`;
  const rows = guestEntries.map((e) => ({
    userId: e.userId,
    shortId: `${e.userId.slice(0, 8)}…`,
    score: e.score,
    selected: selected.includes(e.userId),
    toggleLabel: `${e.userId} 선택`,
  }));
  const empty = guestEntries.length === 0;
  const canRemove = selected.length > 0;
  const removeLabel = canRemove ? `${selected.length}건 제거` : '선택 후 삭제';
  return { summaryText, rows, empty, canRemove, removeLabel };
}
