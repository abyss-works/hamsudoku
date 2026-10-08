import { getSessionUser } from './auth';

/** 본인 계정만 접근 가능한 관리자 판정 — env ADMIN_UIDS(콤마 구분)에 uid가 포함되면 통과. */
export async function isAdmin(): Promise<boolean> {
  const { uid } = await getSessionUser();
  if (!uid) return false;
  const allow = (process.env.ADMIN_UIDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return allow.includes(uid);
}
