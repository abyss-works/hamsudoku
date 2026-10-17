import { sql } from 'drizzle-orm';
import type { Executor } from '../db/client';
import { utcTimestamp } from '../db/sql';
import type { PlayEvent } from '../../shared/endless';
import type { PlayAudit, PlayLogError } from './rules';
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
 * 검증된 클리어의 진행 기록, 지갑 적립, 연속 기록, 검증 이벤트를 한 문장으로 반영하고 적립액과 갱신 후 잔액·연속 기록을 반환한다.
 * 적립액은 남은 씨앗 수에서 이 판의 이전 최고 잔여 씨앗(클리어하지 않았으면 0)을 뺀 값이며 0보다 작지 않다.
 * 씨앗 3개면 연속 기록을 늘리고 아니면 0으로 되돌린다. 재클리어도 같은 연속 기록 규칙을 따른다.
 */
export async function commitClear(
  tx: Executor,
  input: ClearCommitInput,
): Promise<{ earned: number; balance: number; streak: { current: number; best: number } }> {
  const at = utcTimestamp(input.at);
  const perfect = input.seedLeft === 3;
  const result = await tx.execute<{ earned: number; balance: number; current: number; best: number }>(sql`
    with prior as (
      select coalesce((
        select "bestSeedLeft" from "EndlessProgress"
        where "userId" = ${input.userId} and "stageId" = ${input.stageId} and "cleared"
      ), 0) as "best"
    ),
    gain as (
      select greatest(${input.seedLeft}::int - "best", 0) as "earned" from prior
    ),
    progress as (
      insert into "EndlessProgress" ("userId", "stageId", "cleared", "attempts", "bestSeedLeft", "lastPlayedAt")
      values (${input.userId}, ${input.stageId}, true, 1, ${input.seedLeft}, ${at})
      on conflict ("userId", "stageId") do update set
        "cleared" = true,
        "attempts" = "EndlessProgress"."attempts" + 1,
        "bestSeedLeft" = greatest("EndlessProgress"."bestSeedLeft", excluded."bestSeedLeft"),
        "lastPlayedAt" = excluded."lastPlayedAt"
    ),
    wallet as (
      insert into "SeedWallet" ("userId", "balance") select ${input.userId}, "earned" from gain
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
    select (select "earned" from gain) as "earned", (select "balance" from wallet) as "balance",
      (select "current" from streak) as "current", (select "best" from streak) as "best"
  `);
  const row = result.rows[0];
  return { earned: row.earned, balance: row.balance, streak: { current: row.current, best: row.best } };
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

/**
 * 감사 결과와 감사 시각을 한 문장으로 저장하고 저장한 기록의 attemptId를 반환한다.
 * 이미 감사 시각이 있는 기록은 바꾸지 않는다.
 */
export async function saveAudits(
  executor: Executor,
  audits: { attemptId: string; audit: PlayAudit }[],
  at: Date,
): Promise<string[]> {
  if (audits.length === 0) return [];
  const result = await executor.execute<{ attemptId: string }>(sql`
    update "EndlessPlayLog" as l set "audit" = v."audit", "auditedAt" = ${utcTimestamp(at)}
    from jsonb_to_recordset(${JSON.stringify(audits)}::jsonb) as v("attemptId" text, "audit" jsonb)
    where l."attemptId" = v."attemptId" and l."auditedAt" is null
    returning l."attemptId"
  `);
  return result.rows.map((row) => row.attemptId);
}
