import { eq, inArray } from 'drizzle-orm';
import type { Executor } from '../db/client';
import { profiles } from './schema';

export async function findNickname(executor: Executor, userId: string): Promise<string | null> {
  const [row] = await executor.select({ nickname: profiles.nickname }).from(profiles).where(eq(profiles.userId, userId));
  return row?.nickname ?? null;
}

/** 요청한 사용자마다 닉네임 또는 null을 돌려준다. 프로필이 없는 사용자도 키로 포함한다. */
export async function findNicknames(executor: Executor, userIds: string[]): Promise<Record<string, string | null>> {
  if (userIds.length === 0) return {};
  const rows = await executor
    .select({ userId: profiles.userId, nickname: profiles.nickname })
    .from(profiles)
    .where(inArray(profiles.userId, userIds));
  const found = new Map(rows.map((row) => [row.userId, row.nickname] as const));
  return Object.fromEntries(userIds.map((id) => [id, found.get(id) ?? null]));
}
