import { sql } from 'drizzle-orm';
import type { Executor } from '../db/client';
import { utcTimestamp } from '../db/sql';
import type { PlayEvent } from '../../shared/endless';
import type { PlayLogError } from './rules';
import { endlessEvents, endlessPlayLogs } from './schema';

/**
 * 같은 사용자의 제출을 트랜잭션이 끝날 때까지 직렬화한다. 다음 문장부터는 앞선 제출의 커밋을 보므로
 * 잠금 뒤에 제출 간격을 검사한다.
 */
export async function lockPlayer(tx: Executor, userId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`endless-player:${userId}`}))`);
}

export interface ClearCommitInput {
  userId: string;
  stageId: string;
  seedLeft: number;
  elapsedMs: number;
  suspicious: boolean;
  at: Date;
}

/**
 * 검증된 클리어의 진행 기록, 지갑 적립, 연속 기록, 검증 이벤트를 한 문장으로 반영하고 갱신 후 잔액과 연속 기록을 반환한다.
 * 적립액은 남은 씨앗 수이고, 씨앗 3개면 연속 기록을 늘리고 아니면 0으로 되돌린다.
 */
export async function commitClear(
  tx: Executor,
  input: ClearCommitInput,
): Promise<{ balance: number; streak: { current: number; best: number } }> {
  const at = utcTimestamp(input.at);
  const perfect = input.seedLeft === 3;
  const result = await tx.execute<{ balance: number; current: number; best: number }>(sql`
    with progress as (
      insert into "EndlessProgress" ("userId", "stageId", "cleared", "attempts", "lastPlayedAt")
      values (${input.userId}, ${input.stageId}, true, 1, ${at})
      on conflict ("userId", "stageId") do update set
        "cleared" = true,
        "attempts" = "EndlessProgress"."attempts" + 1,
        "lastPlayedAt" = excluded."lastPlayedAt"
    ),
    wallet as (
      insert into "SeedWallet" ("userId", "balance") values (${input.userId}, ${input.seedLeft})
      on conflict ("userId") do update set "balance" = "SeedWallet"."balance" + excluded."balance"
      returning "balance"
    ),
    streak as (
      insert into "EndlessStreak" ("userId", "current", "best")
      values (${input.userId}, ${perfect ? 1 : 0}, ${perfect ? 1 : 0})
      on conflict ("userId") do update set
        "current" = case when ${perfect}::boolean then "EndlessStreak"."current" + 1 else 0 end,
        "best" = greatest("EndlessStreak"."best", case when ${perfect}::boolean then "EndlessStreak"."current" + 1 else 0 end)
      returning "current", "best"
    ),
    event as (
      insert into "EndlessEvent" ("userId", "stageId", "seedLeft", "elapsedMs", "verified", "suspicious", "createdAt")
      values (${input.userId}, ${input.stageId}, ${input.seedLeft}, ${input.elapsedMs}, true, ${input.suspicious}, ${at})
    )
    select (select "balance" from wallet) as "balance", (select "current" from streak) as "current", (select "best" from streak) as "best"
  `);
  const row = result.rows[0];
  return { balance: row.balance, streak: { current: row.current, best: row.best } };
}

/** 실패한 판의 진행 시도 수를 늘리고 연속 기록을 0으로 되돌린다. 이미 클리어한 판의 클리어 상태는 유지한다. */
export async function commitFail(tx: Executor, input: { userId: string; stageId: string; at: Date }): Promise<void> {
  const at = utcTimestamp(input.at);
  await tx.execute(sql`
    with progress as (
      insert into "EndlessProgress" ("userId", "stageId", "cleared", "attempts", "lastPlayedAt")
      values (${input.userId}, ${input.stageId}, false, 1, ${at})
      on conflict ("userId", "stageId") do update set
        "attempts" = "EndlessProgress"."attempts" + 1,
        "lastPlayedAt" = excluded."lastPlayedAt"
    )
    insert into "EndlessStreak" ("userId", "current", "best") values (${input.userId}, 0, 0)
    on conflict ("userId") do update set "current" = 0
  `);
}

/** 보상하지 않은 제출을 사유와 함께 기록한다. 이후 의심 패턴 판정의 최근 이벤트에 포함된다. */
export async function appendPlayEvent(
  executor: Executor,
  input: { userId: string; stageId: string; seedLeft: number; elapsedMs: number; reason: string; at: Date },
): Promise<void> {
  await executor.insert(endlessEvents).values({
    userId: input.userId,
    stageId: input.stageId,
    seedLeft: input.seedLeft,
    elapsedMs: input.elapsedMs,
    verified: false,
    suspicious: false,
    reason: input.reason,
    createdAt: input.at,
  });
}

export interface PlayLogRow {
  attemptId: string;
  userId: string;
  stageId: string;
  outcome: 'clear' | 'fail';
  accepted: boolean;
  reason: string | null;
  claimedSeedLeft: number | null;
  serverElapsedMs: number;
  logVersion: number | null;
  events: PlayEvent[] | null;
  logError: PlayLogError | null;
  at: Date;
}

/** 입장 키 하나의 플레이 기록을 저장한다. 같은 키의 기록이 이미 있으면 바꾸지 않는다. */
export async function savePlayLog(executor: Executor, row: PlayLogRow): Promise<void> {
  await executor
    .insert(endlessPlayLogs)
    .values({
      attemptId: row.attemptId,
      userId: row.userId,
      stageId: row.stageId,
      outcome: row.outcome,
      accepted: row.accepted,
      reason: row.reason,
      claimedSeedLeft: row.claimedSeedLeft,
      serverElapsedMs: row.serverElapsedMs,
      logVersion: row.logVersion,
      events: row.events,
      logError: row.logError,
      createdAt: row.at,
    })
    .onConflictDoNothing({ target: endlessPlayLogs.attemptId });
}
