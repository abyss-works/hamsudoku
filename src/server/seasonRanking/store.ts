import { sql } from 'drizzle-orm';
import type { Executor } from '../db/client';
import { utcTimestamp } from '../db/sql';
import type { SeasonFinalizationHeader, SeasonRankResult } from './queries';
import { seasonFinalizations, seasonRankResults } from './schema';

// 시즌 잠금 키. 클리어 적립과 시즌 확정이 같은 키를 쓴다.
function seasonLockKey(season: string) {
  return sql`hashtext(${`season:${season}`})`;
}

/** 클리어 적립용 공유 잠금. 클리어끼리는 서로 기다리지 않고 시즌 확정과는 서로 배제된다. */
export async function lockSeasonForEarning(tx: Executor, season: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock_shared(${seasonLockKey(season)})`);
}

/** 시즌 확정용 배타 잠금. 진행 중인 클리어 적립이 끝날 때까지 기다린다. */
export async function lockSeasonForFinalization(tx: Executor, season: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(${seasonLockKey(season)})`);
}

export interface EarningInput {
  userId: string;
  stageId: string;
  season: string;
  amount: number;
  at: Date;
  /** 적립 시각이 시즌 집계 구간 안이고 집계 마감 창 밖인지(countsForRanking). */
  inRankingWindow: boolean;
}

/** 시즌 원장에 적립을 기록한다. 이미 확정된 시즌의 적립은 같은 문장에서 랭킹 대상에서 제외한다. */
export async function appendEarning(executor: Executor, input: EarningInput): Promise<{ rankingEligible: boolean }> {
  const result = await executor.execute<{ rankingEligible: boolean }>(sql`
    insert into "SeedLedger" ("userId", "kind", "amount", "stageId", "season", "createdAt", "rankingEligible")
    select ${input.userId}, 'earn', ${input.amount}, ${input.stageId}, ${input.season}, ${utcTimestamp(input.at)},
      ${input.inRankingWindow}::boolean
        and not exists (select 1 from "SeasonFinalization" where "season" = ${input.season} and "status" = 'finalized')
    returning "rankingEligible"
  `);
  return { rankingEligible: result.rows[0].rankingEligible };
}

/** 확정 머리 행과 전체 참여자 결과를 저장한다. 시즌 배타 잠금 안에서 한 번만 호출한다. */
export async function saveSeasonFinalization(
  tx: Executor,
  header: SeasonFinalizationHeader,
  results: SeasonRankResult[],
): Promise<void> {
  await tx.insert(seasonFinalizations).values({
    season: header.season,
    startAt: new Date(header.startAt),
    endAt: new Date(header.endAt),
    finalizedAt: new Date(header.finalizedAt),
    status: header.status,
  });
  if (results.length > 0) await tx.insert(seasonRankResults).values(results);
}
