import { sql } from 'drizzle-orm';
import type { PlayEvent as PlayLogEvent } from '../../shared/endless';
import type { Executor } from '../db/client';

export interface PlayEvent {
  seedLeft: number;
  verified: boolean;
  createdAt: Date;
}

export interface SubmissionHistory {
  /** 최근 제출 이벤트(검증·무효 포함), 기록 시각 역순. */
  recent: PlayEvent[];
  /** 개수 제한과 무관한 마지막 검증 클리어 시각. 없으면 null이다. */
  lastVerifiedAt: Date | null;
}

/**
 * 제출 판정에 쓰는 이력을 한 문장으로 조회한다. 시각은 UTC 기준 epoch 밀리초로 받아 세션 시간대의 영향을 받지 않는다.
 */
export async function findSubmissionHistory(executor: Executor, userId: string, limit: number): Promise<SubmissionHistory> {
  const result = await executor.execute<{
    seedLeft: number | null;
    verified: boolean | null;
    createdAtMs: number | null;
    lastVerifiedMs: number | null;
  }>(sql`
    select r."seedLeft", r."verified", (extract(epoch from r."createdAt") * 1000)::float8 as "createdAtMs",
      (select (extract(epoch from "createdAt") * 1000)::float8 from "EndlessEvent"
        where "userId" = ${userId} and "verified" order by "createdAt" desc limit 1) as "lastVerifiedMs"
    from (select 1) as base
    left join lateral (
      select "seedLeft", "verified", "createdAt" from "EndlessEvent"
      where "userId" = ${userId} order by "createdAt" desc limit ${limit}
    ) r on true
    order by r."createdAt" desc
  `);
  const [first] = result.rows;
  return {
    recent: result.rows.flatMap((row) =>
      row.seedLeft === null || row.verified === null || row.createdAtMs === null
        ? []
        : [{ seedLeft: row.seedLeft, verified: row.verified, createdAt: new Date(row.createdAtMs) }],
    ),
    lastVerifiedAt: first.lastVerifiedMs === null ? null : new Date(first.lastVerifiedMs),
  };
}

export interface PlayableStage {
  id: string;
  size: number;
  regions: string;
  solution: string;
}

/** 사용자가 씨앗 3개로 클리어하지 않은 판(미클리어 판과 씨앗을 잃고 클리어한 판) 중 하나를 무작위로 고른다. 없으면 null이다. */
export async function pickPlayableStage(executor: Executor, userId: string): Promise<PlayableStage | null> {
  const result = await executor.execute<PlayableStage & Record<string, unknown>>(sql`
    select s."id", s."size", s."regions", s."solution" from "EndlessStage" s
    where not exists (
      select 1 from "EndlessProgress" p
      where p."userId" = ${userId} and p."stageId" = s."id" and p."cleared" and p."bestSeedLeft" >= 3
    )
    order by random() limit 1
  `);
  return result.rows[0] ?? null;
}

export interface PlaySummary {
  balance: number;
  clearedCount: number;
  streak: { current: number; best: number };
}

/** 지갑 잔액, 클리어한 판 수, 연속 기록을 한 문장으로 조회한다. 기록이 없으면 0이다. */
export async function findPlaySummary(executor: Executor, userId: string): Promise<PlaySummary> {
  const result = await executor.execute<{ balance: number; clearedCount: number; current: number; best: number }>(sql`
    select
      coalesce((select "balance" from "SeedWallet" where "userId" = ${userId}), 0) as "balance",
      (select count(*)::int from "EndlessProgress" where "userId" = ${userId} and "cleared") as "clearedCount",
      coalesce((select "current" from "EndlessStreak" where "userId" = ${userId}), 0) as "current",
      coalesce((select "best" from "EndlessStreak" where "userId" = ${userId}), 0) as "best"
  `);
  const row = result.rows[0];
  return { balance: row.balance, clearedCount: row.clearedCount, streak: { current: row.current, best: row.best } };
}

export interface UnauditedPlayLog {
  attemptId: string;
  outcome: 'clear' | 'fail';
  claimedSeedLeft: number | null;
  serverElapsedMs: number;
  events: PlayLogEvent[] | null;
  solution: string;
}

/** 감사하지 않은 플레이 기록을 판 정답과 함께 저장 시각 순으로 지정한 개수까지 조회한다. */
export async function findUnauditedPlayLogs(executor: Executor, limit: number): Promise<UnauditedPlayLog[]> {
  const result = await executor.execute<UnauditedPlayLog & Record<string, unknown>>(sql`
    select l."attemptId", l."outcome", l."claimedSeedLeft", l."serverElapsedMs", l."events", s."solution"
    from "EndlessPlayLog" l
    join "EndlessStage" s on s."id" = l."stageId"
    where l."auditedAt" is null
    order by l."createdAt", l."attemptId"
    limit ${limit}
  `);
  return result.rows;
}
