import { desc, eq, sql } from 'drizzle-orm';
import type { Executor } from '../db/client';
import { endlessEvents } from './schema';

export interface PlayEvent {
  seedLeft: number;
  verified: boolean;
  createdAt: Date;
}

/** 사용자의 최근 제출 이벤트(검증·무효 포함)를 기록 시각 역순으로 반환한다. */
export async function listRecentPlayEvents(executor: Executor, userId: string, limit: number): Promise<PlayEvent[]> {
  return executor
    .select({ seedLeft: endlessEvents.seedLeft, verified: endlessEvents.verified, createdAt: endlessEvents.createdAt })
    .from(endlessEvents)
    .where(eq(endlessEvents.userId, userId))
    .orderBy(desc(endlessEvents.createdAt))
    .limit(limit);
}

export interface PlayableStage {
  id: string;
  size: number;
  regions: string;
  solution: string;
}

/** 사용자가 아직 클리어하지 않은 판 하나를 무작위로 고른다. 없으면 null이다. */
export async function pickUnclearedStage(executor: Executor, userId: string): Promise<PlayableStage | null> {
  const result = await executor.execute<PlayableStage & Record<string, unknown>>(sql`
    select s."id", s."size", s."regions", s."solution" from "EndlessStage" s
    where not exists (
      select 1 from "EndlessProgress" p where p."userId" = ${userId} and p."stageId" = s."id" and p."cleared"
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
