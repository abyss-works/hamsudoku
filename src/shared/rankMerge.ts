import type { RankEntry, RankResponse } from './endless';

const MAX_TOP_ENTRIES = 50;


function shouldInsertMe(meScore: number, meUid: string, entryScore: number, entryUid: string): boolean {
  if (meScore > entryScore) return true;
  if (meScore === entryScore && meUid > entryUid) return true;
  return false;
}

// 스냅샷 점수들에 내 실시간 점수를 끼워넣어 표시용 순위표를 다시 만든다.
// 스냅샷에 내 행이 있으면 제거하고 실시간 값 하나로 합치며, 동일 userId 중복을 제거한다.
// top 배열은 점수 내림차순, userId 내림차순으로 정렬된다.
// 상위 50명 목록에 들지 못하는 경우 목록 뒤에 임의로 51위로 끼워넣지 않고 서버 순위를 보존한다.
export function mergeRankEntries(
  rank: RankResponse,
  uid: string,
  live?: { score: number; nickname: string | null },
): { entries: RankEntry[]; meRank: number | null } {
  const snapshotMe = rank.top.find((e) => e.userId === uid);
  const seen = new Set<string>();
  const merged: RankEntry[] = [];
  for (const entry of rank.top) {
    if (entry.userId === uid) continue;
    if (seen.has(entry.userId)) continue;
    seen.add(entry.userId);
    merged.push(entry);
  }

  const score = live?.score ?? rank.me.score;
  const meEntry: RankEntry = { userId: uid, nickname: live?.nickname ?? snapshotMe?.nickname ?? null, score };

  const display: RankEntry[] = [];
  let meRank: number | null = null;
  let inserted = false;

  for (const entry of merged) {
    if (!inserted && shouldInsertMe(score, uid, entry.score, entry.userId)) {
      display.push(meEntry);
      meRank = display.length;
      inserted = true;
    }
    display.push(entry);
  }

  if (!inserted) {
    // 상위 50명 목록이 가득 찬 상태에서 미달하면 51번째로 끼우지 않는다.
    if (merged.length < MAX_TOP_ENTRIES) {
      display.push(meEntry);
      meRank = display.length;
    } else {
      meRank = rank.me.rank;
    }
  }

  return {
    entries: display.slice(0, MAX_TOP_ENTRIES),
    meRank: meRank ?? rank.me.rank,
  };
}

