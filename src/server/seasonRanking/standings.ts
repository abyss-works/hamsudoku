import { rankedSeasonId, rankingFrozen, seasonWindow } from '../../shared/season';
import { findNicknames } from '../account/queries';
import { db } from '../db/client';
import type { Defer } from '../defer';
import { createQStashPublisher } from '../qstashPublisher';
import { rankStoreFromEnv } from '../rank';
import { findFinalizedSeasonTop, findSeasonStanding, listSeasonEarnings } from './queries';

const TOP_LIMIT = 50;

export interface RankEntryView {
  userId: string;
  nickname: string | null;
  score: number;
}

export interface SeasonRankView {
  season: string;
  top: RankEntryView[];
  snapshotAt: string;
  me: { rank: number | null; score: number };
  frozen: boolean;
  status: 'active' | 'aggregating' | 'finalized';
}

/** 표시용 닉네임. 조회가 실패하면 관측하고 모두 null로 대체해 점수 목록 응답을 유지한다. */
export async function displayNicknames(userIds: string[]): Promise<Record<string, string | null>> {
  try {
    return await findNicknames(db, userIds);
  } catch {
    console.warn('Nickname lookup failed');
    return Object.fromEntries(userIds.map((id) => [id, null]));
  }
}

async function withNicknames(entries: { userId: string; score: number }[]): Promise<RankEntryView[]> {
  const nicknames = await displayNicknames(entries.map((entry) => entry.userId));
  return entries.map((entry) => ({ userId: entry.userId, nickname: nicknames[entry.userId] ?? null, score: entry.score }));
}

/**
 * 시즌 순위 화면. 확정된 시즌은 확정 결과를, 집계 마감 창의 미확정 시즌은 집계 중 상태를 반환하고
 * 확정 작업 요청을 응답 뒤로 미룬다. 진행 중인 시즌의 상위 목록은 Redis 표시 캐시를 거치고 내 순위는 원장에서 계산한다.
 */
export async function fetchSeasonRank(uid: string, now: Date, defer: Defer): Promise<SeasonRankView> {
  const frozen = rankingFrozen(now);
  const season = rankedSeasonId(now);
  const window = seasonWindow(season);

  const finalized = await findFinalizedSeasonTop(db, season, TOP_LIMIT);
  const standing = await findSeasonStanding(db, { season, userId: uid, window });
  const me = { rank: standing.rank, score: standing.score };

  if (finalized) {
    return {
      season,
      top: await withNicknames(finalized.results),
      snapshotAt: finalized.header.finalizedAt,
      me,
      frozen,
      status: 'finalized',
    };
  }

  if (frozen) {
    // 중복 방지 키로 등록하므로 여러 요청이 같은 시즌을 요청해도 확정 작업은 하나다.
    defer(async () => {
      try {
        await createQStashPublisher().enqueueFinalize(season);
      } catch {
        console.warn('Ranking finalization enqueue failed');
      }
    });
    return { season, top: [], snapshotAt: now.toISOString(), me, frozen: true, status: 'aggregating' };
  }

  const store = rankStoreFromEnv();
  if (!store) return { season, top: [], snapshotAt: now.toISOString(), me, frozen: false, status: 'active' };

  let entries: { userId: string; score: number }[] = [];
  let snapshotAt = now.toISOString();
  try {
    const snapshot = await store.top(season, TOP_LIMIT, async () =>
      (await listSeasonEarnings(db, season, window)).map((row) => ({ userId: row.userId, score: row.amount })),
    );
    entries = snapshot.entries;
    snapshotAt = snapshot.at;
  } catch {
    // Redis 오류 시 빈 목록으로 폴백하되 내 DB 점수는 보존한다.
  }
  return { season, top: await withNicknames(entries), snapshotAt, me, frozen: false, status: 'active' };
}

/** 내 순위. Redis를 거치지 않고 확정 결과 또는 원장에서 한 문장으로 계산한다. */
export async function fetchMySeasonRank(
  uid: string,
  now: Date,
): Promise<{ season: string; rank: number | null; score: number; nickname: string | null }> {
  const season = rankedSeasonId(now);
  const standing = await findSeasonStanding(db, { season, userId: uid, window: seasonWindow(season) });
  return { season, rank: standing.rank, score: standing.score, nickname: standing.nickname };
}
