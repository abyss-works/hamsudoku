import { rankedSeasonId, rankingFrozen, seasonId, seasonWindow } from '../../shared/season';
import { findNicknames } from '../account/queries';
import { db } from '../db/client';
import { rankCache } from '../rank';
import { findFinalizedSeasonTop, findSeasonStanding, listSeasonTopEarnings } from './queries';
import { excludeSeasonEarnings } from './store';

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
 * 시즌 순위 화면. 확정된 시즌은 확정 결과를, 집계 마감 창의 미확정 시즌은 집계 중 상태를 반환한다.
 * 시즌 확정은 주간·일일 예약 작업이 수행한다. 진행 중인 시즌의 상위 목록은 프로세스 내 표시 캐시를 거치고
 * 내 순위는 원장에서 계산한다.
 */
export async function fetchSeasonRank(uid: string, now: Date): Promise<SeasonRankView> {
  const frozen = rankingFrozen(now);
  const season = rankedSeasonId(now);
  const window = seasonWindow(season);

  const [finalized, standing] = await Promise.all([
    findFinalizedSeasonTop(db, season, TOP_LIMIT),
    findSeasonStanding(db, { season, userId: uid, window }),
  ]);
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

  if (frozen) return { season, top: [], snapshotAt: now.toISOString(), me, frozen: true, status: 'aggregating' };

  let entries: { userId: string; score: number }[] = [];
  let snapshotAt = now.toISOString();
  try {
    const snapshot = await rankCache.top(season, TOP_LIMIT, () => listSeasonTopEarnings(db, season, window, TOP_LIMIT));
    entries = snapshot.entries;
    snapshotAt = snapshot.at;
  } catch {
    // 상위 목록 조회가 실패하면 빈 목록으로 폴백하되 내 DB 점수는 보존한다.
    console.warn('Season top ranking load failed');
  }
  return { season, top: await withNicknames(entries), snapshotAt, me, frozen: false, status: 'active' };
}

/** 내 순위. 표시 캐시를 거치지 않고 확정 결과 또는 원장에서 한 문장으로 계산한다. */
export async function fetchMySeasonRank(
  uid: string,
  now: Date,
): Promise<{ season: string; rank: number | null; score: number; nickname: string | null }> {
  const season = rankedSeasonId(now);
  const standing = await findSeasonStanding(db, { season, userId: uid, window: seasonWindow(season) });
  return { season, rank: standing.rank, score: standing.score, nickname: standing.nickname };
}

const ADMIN_LIMIT = 200;

/** 관리자용 현재 시즌 상위 목록. 표시 캐시를 거치지 않고 원장에서 읽으며 닉네임이 없는 항목은 게스트다. */
export async function fetchAdminSeasonRank(now: Date): Promise<{ season: string; entries: RankEntryView[] }> {
  const season = seasonId(now);
  const rows = await listSeasonTopEarnings(db, season, seasonWindow(season), ADMIN_LIMIT);
  return { season, entries: await withNicknames(rows) };
}

/**
 * 사용자들의 현재 시즌 적립을 랭킹에서 제외한다. 원장의 랭킹 대상 표시를 내리므로 이후 표시 갱신과 시즌 확정에서도
 * 제외되며, 표시 캐시를 비워 공개 순위에 바로 반영한다. 새로 제외된 사용자 수를 반환한다.
 */
export async function excludeFromSeasonRank(now: Date, userIds: string[]): Promise<number> {
  const season = seasonId(now);
  const removed = await excludeSeasonEarnings(db, season, userIds);
  rankCache.invalidate(season);
  return removed;
}
