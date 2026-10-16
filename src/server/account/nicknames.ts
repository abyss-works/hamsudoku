import { validateNickname } from '../../features/account/model/nickname';
import { db } from '../db/client';
import { findNickname, findNicknames } from './queries';
import { saveNickname } from './store';

// 랭킹 표시용 이름 조회는 최대 100 uid로 묶는다.
const LOOKUP_LIMIT = 100;

export async function fetchNickname(uid: string | null): Promise<{ status: 200 | 401; nickname: string | null }> {
  if (!uid) return { status: 401, nickname: null };
  return { status: 200, nickname: await findNickname(db, uid) };
}

export async function changeNickname(
  uid: string | null,
  input: string,
  nowIso: string,
): Promise<{ status: 200 | 400 | 401; nickname?: string; msg?: string }> {
  if (!uid) return { status: 401 };
  const validated = validateNickname(input);
  if (!validated.ok) return { status: 400, msg: validated.msg };
  await saveNickname(db, { userId: uid, nickname: validated.nickname, at: new Date(nowIso) });
  return { status: 200, nickname: validated.nickname };
}

export async function lookupNicknames(
  uid: string | null,
  userIds: string[],
): Promise<{ status: 200 | 401; nicknames: Record<string, string | null> }> {
  if (!uid) return { status: 401, nicknames: {} };
  return { status: 200, nicknames: await findNicknames(db, userIds.slice(0, LOOKUP_LIMIT)) };
}
