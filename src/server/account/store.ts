import { sql } from 'drizzle-orm';
import type { Executor } from '../db/client';
import { utcTimestamp } from '../db/sql';
import { profiles } from './schema';

/**
 * 세션 사용자의 계정 행과 프로필 행을 한 문장으로 보장한다. 이메일이 없거나 같으면 사용자 행을 다시 쓰지 않고,
 * 이미 있는 프로필은 바꾸지 않는다. 동시 실행은 충돌 처리로 한 행에 모인다.
 */
export async function upsertAccount(executor: Executor, input: { userId: string; email: string | null; at: Date }): Promise<void> {
  await executor.execute(sql`
    with account as (
      insert into "User" ("id", "email") values (${input.userId}, ${input.email})
      on conflict ("id") do update set "email" = excluded."email"
      where excluded."email" is not null and "User"."email" is distinct from excluded."email"
    )
    insert into "Profile" ("userId", "updatedAt") values (${input.userId}, ${utcTimestamp(input.at)})
    on conflict ("userId") do nothing
  `);
}

export async function saveNickname(executor: Executor, input: { userId: string; nickname: string; at: Date }): Promise<void> {
  await executor
    .insert(profiles)
    .values({ userId: input.userId, nickname: input.nickname, updatedAt: input.at })
    .onConflictDoUpdate({ target: profiles.userId, set: { nickname: input.nickname, updatedAt: input.at } });
}
