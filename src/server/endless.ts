import type { ClearResponse } from '../shared/endless';
import { seasonId } from '../shared/season';
import type { Attempt, DbPort, EndlessStageRow } from './db/port';

export const MIN_CLEAR_MS = 3_000;
export const MIN_SUBMIT_GAP_MS = 1_000;
export const PERFECT_WINDOW = 20;
export const PERFECT_SUSPICIOUS_AT = 16;

const ATTEMPT_TTL_MS = 2 * 60 * 60 * 1000;

function normalizeSolution(pairs: [number, number][] | string): string {
  if (typeof pairs === 'string') {
    return pairs
      .split(';')
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .sort()
      .join(';');
  }
  return pairs.map(([r, c]) => `${r},${c}`).sort().join(';');
}

export async function submitEndlessClear(
  db: DbPort,
  uid: string | null,
  input: { attemptKey: string; stageId: string; solution: [number, number][]; seedLeft: number },
  nowIso: string,
): Promise<{ status: 200 | 401; body?: ClearResponse }> {
  if (!uid) return { status: 401 };
  const stage = await db.getStage(input.stageId);
  if (!stage) return { status: 200, body: { ok: false, reason: '알 수 없는 판이에요.' } };

  const attempt = await db.findAttempt(input.attemptKey);
  const now = Date.parse(nowIso);
  if (
    !attempt ||
    attempt.userId !== uid ||
    attempt.stageCode !== input.stageId ||
    attempt.usedAt !== null ||
    now - Date.parse(attempt.issuedAt) > ATTEMPT_TTL_MS
  ) {
    return { status: 200, body: { ok: false, reason: '입장 키가 유효하지 않아요.' } };
  }
  const used = await db.useAttempt(uid, attempt.id, attempt.stageCode, nowIso);
  if (!used) return { status: 200, body: { ok: false, reason: '입장 키가 유효하지 않아요.' } };

  // 키 소모 뒤의 저장이 실패하면 소모를 되돌려 같은 키로 재제출할 수 있게 한다.
  try {
    return await settleEndlessClear(db, uid, input, stage, attempt, nowIso);
  } catch (e) {
    await db.releaseAttempt(uid, attempt.id);
    throw e;
  }
}

// 키 소모 뒤의 검증·이벤트·보상 저장. 예외는 호출자가 키 소모 복구에 사용한다.
async function settleEndlessClear(
  db: DbPort,
  uid: string,
  input: { stageId: string; solution: [number, number][]; seedLeft: number },
  stage: EndlessStageRow,
  attempt: Attempt,
  nowIso: string,
): Promise<{ status: 200; body: ClearResponse }> {
  const now = Date.parse(nowIso);
  const elapsedMs = now - Date.parse(attempt.issuedAt);
  const invalid = async (eventReason: string, msg: string): Promise<{ status: 200; body: ClearResponse }> => {
    await db.appendEndlessEvent(uid, input.stageId, {
      seedLeft: input.seedLeft,
      elapsedMs,
      verified: false,
      suspicious: false,
      reason: eventReason,
    });
    return { status: 200, body: { ok: false, reason: msg } };
  };

  if (normalizeSolution(input.solution) !== normalizeSolution(stage.solution)) {
    return invalid('정답 불일치', '정답이 맞지 않아요.');
  }
  if (elapsedMs < MIN_CLEAR_MS) return invalid('하한 미달', '제출이 너무 빨라요.');
  if (input.seedLeft < 1) return invalid('잔여 씨앗 없음', '잔여 씨앗이 없어요.');

  const recent = await db.listRecentEndlessEvents(uid, PERFECT_WINDOW);
  const lastVerified = recent.find((e) => e.verified);
  if (lastVerified && now - Date.parse(lastVerified.createdAt) < MIN_SUBMIT_GAP_MS) {
    return invalid('제출 간격 하한', '제출이 너무 잦아요.');
  }
  const perfectCount = recent.filter((e) => e.verified && e.seedLeft === 3).length;
  const suspicious = perfectCount >= PERFECT_SUSPICIOUS_AT;

  const summary = await db.commitEndlessClear(uid, input.stageId, {
    earned: input.seedLeft,
    season: seasonId(new Date(nowIso)),
    seedLeft: input.seedLeft,
    elapsedMs,
    suspicious,
    atIso: nowIso,
    minGapMs: MIN_SUBMIT_GAP_MS,
  });
  // 위 사전 검사를 함께 통과한 동시 제출은 커밋 직렬화 안의 검사에서 걸러진다.
  if (!summary) return invalid('제출 간격 하한', '제출이 너무 잦아요.');
  return {
    status: 200,
    body: { ok: true, earned: input.seedLeft, balance: summary.balance, streak: summary.streak.current, suspicious },
  };
}

export async function submitEndlessFail(
  db: DbPort,
  uid: string | null,
  input: { attemptKey: string },
  nowIso: string,
): Promise<{ status: 200 | 401 | 403 }> {
  if (!uid) return { status: 401 };
  const attempt = await db.findAttempt(input.attemptKey);
  const now = Date.parse(nowIso);
  if (!attempt || attempt.userId !== uid || attempt.usedAt !== null || now - Date.parse(attempt.issuedAt) > ATTEMPT_TTL_MS) {
    return { status: 403 };
  }
  // 키가 가리키는 판이 무한모드 판이어야 한다. 다른 모드의 키는 소모하지 않고 거부한다.
  if (!(await db.getStage(attempt.stageCode))) return { status: 403 };
  const used = await db.useAttempt(uid, attempt.id, attempt.stageCode, nowIso);
  if (!used) return { status: 403 };
  try {
    await db.commitEndlessFail(uid, attempt.stageCode, nowIso);
  } catch (e) {
    await db.releaseAttempt(uid, attempt.id);
    throw e;
  }
  return { status: 200 };
}
