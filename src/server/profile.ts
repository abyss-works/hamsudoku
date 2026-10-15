import { validateNickname } from '../features/account/model/nickname';
import type { DbPort } from './db/port';

// 랭킹 표시용 이름 조회는 최대 100 uid로 묶는다.
const LOOKUP_LIMIT = 100;

export async function fetchNickname(
  db: DbPort,
  uid: string | null,
): Promise<{ status: 200 | 401; nickname: string | null }> {
  if (!uid) return { status: 401, nickname: null };
  return { status: 200, nickname: await db.getNickname(uid) };
}

export async function saveNickname(
  db: DbPort,
  uid: string | null,
  input: string,
): Promise<{ status: 200 | 400 | 401; nickname?: string; msg?: string }> {
  if (!uid) return { status: 401 };
  const v = validateNickname(input);
  if (!v.ok) return { status: 400, msg: v.msg };
  await db.setNickname(uid, v.nickname);
  return { status: 200, nickname: v.nickname };
}

export async function lookupNicknames(
  db: DbPort,
  uid: string | null,
  userIds: string[],
): Promise<{ status: 200 | 401; nicknames: Record<string, string | null> }> {
  if (!uid) return { status: 401, nicknames: {} };
  return { status: 200, nicknames: await db.lookupNicknames(userIds.slice(0, LOOKUP_LIMIT)) };
}

// 표시용 닉네임 조회. 저장소 실패를 관측하고 전체 null로 대체하여 점수 목록 응답을 유지한다.
export async function displayNicknames(
  db: DbPort,
  userIds: string[],
): Promise<Record<string, string | null>> {
  try {
    return await db.lookupNicknames(userIds);
  } catch {
    console.warn('Nickname lookup failed');
    return Object.fromEntries(userIds.map((id) => [id, null]));
  }
}
