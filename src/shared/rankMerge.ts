import type { RankEntry, RankResponse } from './endless';

// 스냅샷 점수들에 내 실시간 점수를 끼워넣어 표시용 순위표를 다시 만든다.
// 스냅샷에 내 행이 있으면 제거하고 실시간 값 하나로 합친다.
// top 배열은 서버가 내림차순으로 정렬해 준다. 나보다 점수가 낮은 행 앞에 내 행을 끼운다.
// 동점 유저는 내 앞을 유지한다(스냅샷의 기존 순서 보장, 안정 정렬).
export function mergeRankEntries(rank: RankResponse, uid: string): { entries: RankEntry[]; meRank: number | null } {
  const snapshotMe = rank.top.find((e) => e.userId === uid);
  const merged = rank.top.filter((e) => e.userId !== uid);
  const meEntry: RankEntry = { userId: uid, nickname: snapshotMe?.nickname ?? null, score: rank.me.score };

  const display: RankEntry[] = [];
  let meRank: number | null = null;
  let inserted = false;

  for (const entry of merged) {
    if (!inserted && rank.me.score >= entry.score) {
      display.push(meEntry);
      meRank = display.length;
      inserted = true;
    }
    display.push(entry);
  }
  if (!inserted) {
    display.push(meEntry);
    meRank = display.length;
  }
  return { entries: display, meRank: meRank ?? rank.me.rank };
}
