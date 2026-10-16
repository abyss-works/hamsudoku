import { isStageCode, STAGE_CODE_PATTERN } from '../../shared/stageCodes';
import { consumeAttempt, issueAttempt, releaseAttempt } from '../attempt/store';
import { db } from '../db/client';
import { listStageRecords, type StageRecord } from './queries';
import { verifiedElapsedSec } from './rules';
import { recordUnverifiedClear, recordVerifiedClear } from './store';

// 입장 키 유효시간 2시간. 퍼즐 한 판은 분 단위라 넉넉하고, 방치 키는 만료로 썩는다.
const ATTEMPT_TTL_MS = 2 * 60 * 60 * 1000;

export async function issueStageEntry(
  uid: string | null,
  stageCode: string,
  now: Date,
): Promise<{ status: 200 | 400 | 401; key?: string }> {
  if (!uid) return { status: 401 };
  if (!isStageCode(stageCode)) return { status: 400 };
  const attempt = await issueAttempt(db, { userId: uid, stageCode, issuedAt: now });
  return { status: 200, key: attempt.id };
}

export async function submitStageClear(
  uid: string | null,
  input: { attemptKey?: string; elapsedSec: number; stageCode?: string },
  nowIso: string,
): Promise<{ status: 200 | 400 | 401 | 403; bestElapsedSec?: number }> {
  if (!uid) return { status: 401 };
  const now = new Date(nowIso);
  if (input.attemptKey) {
    // 무한모드 판의 키, 다른 사용자의 키, 사용·만료된 키는 소모하지 않고 거부한다.
    const attempt = await consumeAttempt(db, {
      key: input.attemptKey,
      userId: uid,
      now,
      ttlMs: ATTEMPT_TTL_MS,
      stageCodePattern: STAGE_CODE_PATTERN,
    });
    if (!attempt) return { status: 403 };
    const secs = verifiedElapsedSec({
      nowMs: now.getTime(),
      issuedAtMs: attempt.issuedAt.getTime(),
      reportedSec: input.elapsedSec,
    });
    // 기록 저장이 실패하면 키 소모를 되돌려 같은 키로 재제출할 수 있게 한다.
    try {
      const record = await recordVerifiedClear(db, { userId: uid, stageCode: attempt.stageCode, elapsedSec: secs, at: now });
      return { status: 200, bestElapsedSec: record.bestElapsedSec ?? secs };
    } catch (error) {
      await releaseAttempt(db, { key: attempt.id, userId: uid });
      throw error;
    }
  }
  if (!input.stageCode) return { status: 400 };
  await recordUnverifiedClear(db, { userId: uid, stageCode: input.stageCode, elapsedSec: input.elapsedSec, at: now });
  return { status: 200 };
}

export async function fetchStageRecords(uid: string | null): Promise<{ status: 200 | 401; clears: StageRecord[] }> {
  if (!uid) return { status: 401, clears: [] };
  return { status: 200, clears: await listStageRecords(db, uid) };
}
