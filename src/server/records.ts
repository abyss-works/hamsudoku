import type { DbPort } from './db';

// 입장 키 유효시간 2시간. 퍼즐 한 판은 분 단위라 넉넉하고, 방치 키는 만료로 썩는다.
const ATTEMPT_TTL_MS = 2 * 60 * 60 * 1000;

export async function issueEntry(
  db: DbPort,
  uid: string | null,
  stageCode: string,
): Promise<{ status: 200 | 401; key?: string }> {
  if (!uid) return { status: 401 };
  const a = await db.issueAttempt(uid, stageCode);
  return { status: 200, key: a.id };
}

export async function submitClear(
  db: DbPort,
  uid: string | null,
  input: { attemptKey?: string; elapsedSec: number; stageCode?: string },
  nowIso: string,
): Promise<{ status: 200 | 400 | 401 | 403; bestElapsedSec?: number }> {
  if (!uid) return { status: 401 };
  if (input.attemptKey) {
    const a = await db.findAttempt(input.attemptKey);
    if (!a || a.userId !== uid || a.usedAt !== null) return { status: 403 };
    if (Date.parse(nowIso) - Date.parse(a.issuedAt) > ATTEMPT_TTL_MS) return { status: 403 };
    const used = await db.useAttempt(uid, a.id, a.stageCode, nowIso);
    if (!used) return { status: 403 };
    const elapsed = Date.parse(nowIso) - Date.parse(a.issuedAt);
    const secs = Number.isFinite(elapsed) && elapsed >= 0 ? Math.floor(elapsed / 1000) : input.elapsedSec;
    await db.recordVerified(uid, a.stageCode, secs, nowIso);
    const rec = (await db.listRecords(uid)).clears.find((c) => c.stageCode === a.stageCode);
    return { status: 200, bestElapsedSec: rec?.bestElapsedSec ?? secs };
  }
  if (!input.stageCode) return { status: 400 };
  await db.recordUnverified(uid, input.stageCode, input.elapsedSec, nowIso);
  return { status: 200 };
}

export async function fetchRecords(
  db: DbPort,
  uid: string | null,
): Promise<{
  status: 200 | 401;
  clears: { stageCode: string; bestElapsedSec: number | null; attempts: number; lastClearedAt: string }[];
}> {
  if (!uid) return { status: 401, clears: [] };
  const { clears } = await db.listRecords(uid);
  return { status: 200, clears };
}
