import { and, asc, eq, sql } from 'drizzle-orm';
import type { Executor } from '../db/client';
import { utcTimestamp } from '../db/sql';
import { seasonFinalizations, seasonRankResults } from './schema';

export interface SeasonWindow {
  startAt: Date;
  endAt: Date;
}

export interface SeasonFinalizationHeader {
  season: string;
  startAt: string;
  endAt: string;
  finalizedAt: string;
  status: string;
}

export interface SeasonRankResult {
  season: string;
  userId: string;
  score: number;
  rank: number;
}

export interface FinalizedSeason {
  header: SeasonFinalizationHeader;
  results: SeasonRankResult[];
}

function earningsFilter(season: string, window: SeasonWindow) {
  return sql`"season" = ${season} and "kind" = 'earn' and "rankingEligible"
    and "createdAt" >= ${utcTimestamp(window.startAt)} and "createdAt" < ${utcTimestamp(window.endAt)}`;
}

/** 시즌 구간 안의 랭킹 대상 적립을 사용자별로 더한다. 순서는 정하지 않는다. */
export async function listSeasonEarnings(
  executor: Executor,
  season: string,
  window: SeasonWindow,
): Promise<{ userId: string; amount: number }[]> {
  const result = await executor.execute<{ userId: string; amount: number }>(sql`
    select "userId", sum("amount")::int as "amount" from "SeedLedger"
    where ${earningsFilter(season, window)}
    group by "userId"
  `);
  return result.rows;
}

/** 확정 집계: 점수 내림차순, 동점은 userId 바이트 순서 내림차순. */
export async function aggregateSeasonLedger(
  executor: Executor,
  season: string,
  window: SeasonWindow,
): Promise<{ userId: string; score: number }[]> {
  const result = await executor.execute<{ userId: string; score: number }>(sql`
    select "userId", sum("amount")::int as "score" from "SeedLedger"
    where ${earningsFilter(season, window)}
    group by "userId"
    order by "score" desc, "userId" collate "C" desc
  `);
  return result.rows;
}

export interface SeasonStanding {
  finalized: boolean;
  rank: number | null;
  score: number;
  nickname: string | null;
}

/**
 * 사용자의 시즌 순위를 한 문장으로 조회한다. 확정된 시즌은 확정 결과를, 그 외에는 원장 집계 순위를 쓴다.
 * 점수가 없거나 0 이하이면 순위 없이 0점이다.
 */
export async function findSeasonStanding(
  executor: Executor,
  input: { season: string; userId: string; window: SeasonWindow },
): Promise<SeasonStanding> {
  const { season, userId, window } = input;
  const result = await executor.execute<{
    finalized: boolean;
    liveScore: number | null;
    liveRank: number;
    finalScore: number | null;
    finalRank: number | null;
    nickname: string | null;
  }>(sql`
    with scores as (
      select "userId", sum("amount")::int as "score" from "SeedLedger"
      where ${earningsFilter(season, window)}
      group by "userId"
    ),
    mine as (select "score" from scores where "userId" = ${userId}),
    final as (select "score", "rank" from "SeasonRankResult" where "season" = ${season} and "userId" = ${userId})
    select
      exists (select 1 from "SeasonFinalization" where "season" = ${season} and "status" = 'finalized') as "finalized",
      (select "score" from mine) as "liveScore",
      (select count(*)::int from scores
        where "score" > (select "score" from mine)
           or ("score" = (select "score" from mine) and "userId" collate "C" > ${userId})) + 1 as "liveRank",
      (select "score" from final) as "finalScore",
      (select "rank" from final) as "finalRank",
      (select "nickname" from "Profile" where "userId" = ${userId}) as "nickname"
  `);
  const row = result.rows[0];
  if (row.finalized) {
    return row.finalRank === null
      ? { finalized: true, rank: null, score: 0, nickname: row.nickname }
      : { finalized: true, rank: row.finalRank, score: row.finalScore ?? 0, nickname: row.nickname };
  }
  if (row.liveScore === null || row.liveScore <= 0) return { finalized: false, rank: null, score: 0, nickname: row.nickname };
  return { finalized: false, rank: row.liveRank, score: row.liveScore, nickname: row.nickname };
}

async function findFinalized(executor: Executor, season: string, limit?: number): Promise<FinalizedSeason | null> {
  const query = executor
    .select({
      season: seasonFinalizations.season,
      startAt: seasonFinalizations.startAt,
      endAt: seasonFinalizations.endAt,
      finalizedAt: seasonFinalizations.finalizedAt,
      status: seasonFinalizations.status,
      userId: seasonRankResults.userId,
      score: seasonRankResults.score,
      rank: seasonRankResults.rank,
    })
    .from(seasonFinalizations)
    .leftJoin(seasonRankResults, eq(seasonRankResults.season, seasonFinalizations.season))
    .where(and(eq(seasonFinalizations.season, season), eq(seasonFinalizations.status, 'finalized')))
    .orderBy(asc(seasonRankResults.rank));
  const rows = limit === undefined ? await query : await query.limit(limit);
  if (rows.length === 0) return null;
  const [first] = rows;
  return {
    header: {
      season: first.season,
      startAt: first.startAt.toISOString(),
      endAt: first.endAt.toISOString(),
      finalizedAt: first.finalizedAt.toISOString(),
      status: first.status,
    },
    results: rows.flatMap((row) =>
      row.userId === null || row.score === null || row.rank === null
        ? []
        : [{ season: row.season, userId: row.userId, score: row.score, rank: row.rank }],
    ),
  };
}

/** 확정된 시즌의 머리 행과 순위 순서의 상위 결과. 확정되지 않았으면 null이다. */
export function findFinalizedSeasonTop(executor: Executor, season: string, limit: number): Promise<FinalizedSeason | null> {
  return findFinalized(executor, season, limit);
}

/** 확정된 시즌의 머리 행과 전체 결과. 확정되지 않았으면 null이다. */
export function findFinalizedSeason(executor: Executor, season: string): Promise<FinalizedSeason | null> {
  return findFinalized(executor, season);
}

/** 원장에 적립이 있으면서 확정되지 않은 시즌 목록(오름차순). */
export async function listUnfinalizedLedgerSeasons(executor: Executor): Promise<string[]> {
  const result = await executor.execute<{ season: string }>(sql`
    select distinct l."season" from "SeedLedger" l
    where not exists (select 1 from "SeasonFinalization" f where f."season" = l."season" and f."status" = 'finalized')
    order by l."season"
  `);
  return result.rows.map((row) => row.season);
}
