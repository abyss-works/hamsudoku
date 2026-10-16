import { sql } from 'drizzle-orm';
import type { Executor } from '../db/client';
import { utcTimestamp } from '../db/sql';
import { clearEvents } from './schema';

export interface ClearInput {
  userId: string;
  stageCode: string;
  elapsedSec: number;
  at: Date;
}

/**
 * 검증된 클리어의 요약 기록 갱신과 이벤트 추가를 한 문장으로 수행하고 갱신 후 최고 기록을 반환한다.
 * 요약은 LEAST·GREATEST로 병합하므로 동시 제출이 같은 이전 값을 읽고 덮어쓰지 않는다. 0초는 최고 기록에 쓰지 않는다.
 */
export async function recordVerifiedClear(executor: Executor, input: ClearInput): Promise<{ bestElapsedSec: number | null }> {
  const best = input.elapsedSec > 0 ? input.elapsedSec : null;
  const result = await executor.execute<{ bestElapsedSec: number | null }>(sql`
    with record as (
      insert into "ClearRecord" ("userId", "stageCode", "bestElapsedSec", "attempts", "lastClearedAt", "updatedAt")
      values (${input.userId}, ${input.stageCode}, ${best}::int, 1, ${utcTimestamp(input.at)}, ${utcTimestamp(input.at)})
      on conflict ("userId", "stageCode") do update set
        "attempts" = "ClearRecord"."attempts" + 1,
        "bestElapsedSec" = least("ClearRecord"."bestElapsedSec", excluded."bestElapsedSec"),
        "lastClearedAt" = greatest("ClearRecord"."lastClearedAt", excluded."lastClearedAt"),
        "updatedAt" = excluded."updatedAt"
      returning "bestElapsedSec"
    ),
    event as (
      insert into "ClearEvent" ("userId", "stageCode", "elapsedSec", "verified", "clearedAt")
      values (${input.userId}, ${input.stageCode}, ${input.elapsedSec}, true, ${utcTimestamp(input.at)})
    )
    select "bestElapsedSec" from record
  `);
  return { bestElapsedSec: result.rows[0]?.bestElapsedSec ?? null };
}

/** 입장 키 없이 제출된 클리어는 이벤트만 남기고 요약 기록에 반영하지 않는다. */
export async function recordUnverifiedClear(executor: Executor, input: ClearInput): Promise<void> {
  await executor.insert(clearEvents).values({
    userId: input.userId,
    stageCode: input.stageCode,
    elapsedSec: input.elapsedSec,
    verified: false,
    clearedAt: input.at,
  });
}
