import { and, eq, gte, isNull, sql, type SQL } from 'drizzle-orm';
import type { Executor } from '../db/client';
import { attempts } from './schema';

/** 입장 키를 발급한다. 발급 시각은 소모 시 경과 시간과 만료를 계산하는 애플리케이션 시각과 같은 기준으로 기록한다. */
export async function issueAttempt(
  executor: Executor,
  input: { userId: string; stageCode: string; issuedAt: Date },
): Promise<{ id: string }> {
  const [row] = await executor
    .insert(attempts)
    .values({ userId: input.userId, stageCode: input.stageCode, issuedAt: input.issuedAt })
    .returning({ id: attempts.id });
  return row;
}

export interface ConsumedAttempt {
  id: string;
  stageCode: string;
  issuedAt: Date;
}

export interface ConsumeAttemptInput {
  key: string;
  userId: string;
  now: Date;
  /** 발급 후 이 시간이 지난 키는 소모하지 않는다. 경계 시각은 유효하다. */
  ttlMs: number;
  /** 키의 판 코드가 이 정규식(Postgres 문법)과 맞을 때만 소모한다. */
  stageCodePattern?: string;
  /** 키의 판 코드가 이 값과 같을 때만 소모한다. */
  stageCode?: string;
  /** 키의 판 코드가 무한모드 판으로 존재할 때만 소모한다. */
  requireEndlessStage?: boolean;
}

/** 소유자·미사용·유효 시간·판 조건을 모두 만족하는 키를 한 문장으로 소모한다. 조건이 맞지 않으면 null이다. */
export async function consumeAttempt(executor: Executor, input: ConsumeAttemptInput): Promise<ConsumedAttempt | null> {
  const conditions: SQL[] = [
    eq(attempts.id, input.key),
    eq(attempts.userId, input.userId),
    isNull(attempts.usedAt),
    gte(attempts.issuedAt, new Date(input.now.getTime() - input.ttlMs)),
  ];
  if (input.stageCodePattern !== undefined) conditions.push(sql`${attempts.stageCode} ~ ${input.stageCodePattern}`);
  if (input.stageCode !== undefined) conditions.push(eq(attempts.stageCode, input.stageCode));
  if (input.requireEndlessStage) {
    conditions.push(sql`exists (select 1 from "EndlessStage" where "EndlessStage"."id" = ${attempts.stageCode})`);
  }

  const [row] = await executor
    .update(attempts)
    .set({ usedAt: input.now })
    .where(and(...conditions))
    .returning({ id: attempts.id, stageCode: attempts.stageCode, issuedAt: attempts.issuedAt });
  return row ?? null;
}

/** 소모 뒤 기록 저장이 실패했을 때 같은 키로 다시 제출할 수 있게 소모를 되돌린다. */
export async function releaseAttempt(executor: Executor, input: { key: string; userId: string }): Promise<void> {
  await executor
    .update(attempts)
    .set({ usedAt: null })
    .where(and(eq(attempts.id, input.key), eq(attempts.userId, input.userId)));
}
