import type { ClearResponse } from '../../shared/endless';
import { seasonId } from '../../shared/season';
import { consumeAttempt, issueAttempt, releaseAttempt } from '../attempt/store';
import { db, withTransaction } from '../db/client';
import { describeDbError } from '../db/errors';
import type { Defer } from '../defer';
import { findStage } from '../endlessPool/queries';
import { recordStagePlay } from '../endlessPool/store';
import { requestSupply, type SupplyEnqueuer } from '../endlessPool/supply';
import { deferRankEarning } from '../seasonRanking/rankCache';
import { countsForRanking } from '../seasonRanking/rules';
import { appendEarning, lockSeasonForEarning } from '../seasonRanking/store';
import { findPlaySummary, findSubmissionHistory, pickPlayableStage, type PlayableStage, type PlaySummary } from './queries';
import { assessSubmission, clearRejection, PERFECT_WINDOW, readPlayLog, solutionMatches } from './rules';
import { appendPlayEvent, commitClear, commitFail, lockPlayer, savePlayLog, type PlayLogRow } from './store';

const ATTEMPT_TTL_MS = 2 * 60 * 60 * 1000;
const INVALID_KEY = '입장 키가 유효하지 않아요.';

type PlayLogSubmission = Omit<PlayLogRow, 'logVersion' | 'events' | 'logError'> & { rawLog: unknown };

/**
 * 소모한 입장 키의 플레이 기록 저장을 응답 뒤로 미룬다. 기록의 판정과 저장은 응답과 보상에 영향을 주지 않으며,
 * 실패하면 기록 원문 없이 오류 요약만 남긴다.
 */
function deferPlayLog(defer: Defer, { rawLog, ...row }: PlayLogSubmission): void {
  defer(async () => {
    try {
      await savePlayLog(db, { ...row, ...readPlayLog(rawLog) });
    } catch (error) {
      console.error('Failed to save play log', describeDbError(error));
    }
  });
}

/**
 * 씨앗 3개로 클리어하지 않은 판과 입장 키를 발급한다. 판 재고 판정과 생성 요청 발행은 응답 뒤에 수행하며 실패는 응답에 영향을 주지 않는다.
 */
export async function startEndlessStage(
  uid: string,
  now: Date,
  defer: Defer,
  enqueuer: SupplyEnqueuer,
): Promise<{ stage: PlayableStage; attemptKey: string } | null> {
  defer(async () => {
    try {
      const decision = await requestSupply(now, enqueuer);
      if (decision.enqueueError) console.warn('Supply enqueue warning (non-fatal):', decision.enqueueError);
    } catch (error) {
      console.error('Failed to trigger supply', describeDbError(error));
    }
  });
  const stage = await pickPlayableStage(db, uid);
  if (!stage) return null;
  const attempt = await issueAttempt(db, { userId: uid, stageCode: stage.id, issuedAt: now });
  return { stage, attemptKey: attempt.id };
}

/**
 * 무한모드 클리어 제출. 판 확인과 입장 키 소모는 트랜잭션 밖에서 한 문장씩 수행하고, 보상 반영은
 * 시즌 공유 잠금 → 사용자 잠금 → 제출 간격 검사 → 진행·지갑·연속 기록·이벤트 → 시즌 원장 → 판 통계 순서로 한 트랜잭션에서 수행한다.
 * 키 소모 뒤 저장이 실패하면 소모를 되돌린다. Redis 순위 가산과 플레이 기록 저장은 응답 뒤로 미룬다.
 */
export async function submitEndlessClear(
  uid: string | null,
  input: { attemptKey: string; stageId: string; solution: [number, number][]; seedLeft: number; log?: unknown },
  nowIso: string,
  defer: Defer,
): Promise<{ status: 200 | 401; body?: ClearResponse }> {
  if (!uid) return { status: 401 };
  const now = new Date(nowIso);
  const stage = await findStage(db, input.stageId);
  if (!stage) return { status: 200, body: { ok: false, reason: '알 수 없는 판이에요.' } };

  const attempt = await consumeAttempt(db, {
    key: input.attemptKey,
    userId: uid,
    now,
    ttlMs: ATTEMPT_TTL_MS,
    stageCode: input.stageId,
  });
  if (!attempt) return { status: 200, body: { ok: false, reason: INVALID_KEY } };

  const elapsedMs = now.getTime() - attempt.issuedAt.getTime();
  const deferLog = (accepted: boolean, reason: string | null) =>
    deferPlayLog(defer, {
      attemptId: attempt.id,
      userId: uid,
      stageId: input.stageId,
      outcome: 'clear',
      accepted,
      reason,
      claimedSeedLeft: input.seedLeft,
      serverElapsedMs: elapsedMs,
      rawLog: input.log,
      at: now,
    });
  const reject = async (event: string, message: string): Promise<{ status: 200; body: ClearResponse }> => {
    await appendPlayEvent(db, { userId: uid, stageId: input.stageId, seedLeft: input.seedLeft, elapsedMs, reason: event, at: now });
    deferLog(false, event);
    return { status: 200, body: { ok: false, reason: message } };
  };

  try {
    const rejection = clearRejection({
      solutionOk: solutionMatches(input.solution, stage.solution),
      elapsedMs,
      seedLeft: input.seedLeft,
    });
    if (rejection) return await reject(rejection.event, rejection.message);

    const season = seasonId(now);
    const committed = await withTransaction(async (tx) => {
      await lockSeasonForEarning(tx, season);
      await lockPlayer(tx, uid);
      const history = await findSubmissionHistory(tx, uid, PERFECT_WINDOW);
      const verdict = assessSubmission(history.recent, history.lastVerifiedAt, now);
      if (verdict.tooSoon) return null;
      const summary = await commitClear(tx, {
        userId: uid,
        stageId: input.stageId,
        seedLeft: input.seedLeft,
        elapsedMs,
        suspicious: verdict.suspicious,
        at: now,
      });
      if (summary.earned > 0) {
        await appendEarning(tx, {
          userId: uid,
          stageId: input.stageId,
          season,
          amount: summary.earned,
          at: now,
          inRankingWindow: countsForRanking(season, now),
        });
      }
      await recordStagePlay(tx, input.stageId, { cleared: true, elapsedMs });
      return { summary, suspicious: verdict.suspicious };
    });
    if (!committed) return await reject('제출 간격 하한', '제출이 너무 잦아요.');

    if (committed.summary.earned > 0) {
      deferRankEarning(defer, { season, userId: uid, amount: committed.summary.earned, at: now });
    }
    deferLog(true, null);
    return {
      status: 200,
      body: {
        ok: true,
        earned: committed.summary.earned,
        balance: committed.summary.balance,
        streak: committed.summary.streak.current,
        suspicious: committed.suspicious,
      },
    };
  } catch (error) {
    await releaseAttempt(db, { key: attempt.id, userId: uid });
    throw error;
  }
}

/**
 * 무한모드 실패 보고. 무한모드 판을 가리키는 유효한 키만 한 문장으로 소모하고, 진행·연속 기록과 판 플레이 수를
 * 한 트랜잭션으로 반영한다. 저장이 실패하면 소모를 되돌린다. 플레이 기록 저장은 응답 뒤로 미룬다.
 */
export async function submitEndlessFail(
  uid: string | null,
  input: { attemptKey: string; log?: unknown },
  nowIso: string,
  defer: Defer,
): Promise<{ status: 200 | 401 | 403 }> {
  if (!uid) return { status: 401 };
  const now = new Date(nowIso);
  const attempt = await consumeAttempt(db, {
    key: input.attemptKey,
    userId: uid,
    now,
    ttlMs: ATTEMPT_TTL_MS,
    requireEndlessStage: true,
  });
  if (!attempt) return { status: 403 };
  try {
    await withTransaction(async (tx) => {
      await commitFail(tx, { userId: uid, stageId: attempt.stageCode, at: now });
      await recordStagePlay(tx, attempt.stageCode, { cleared: false });
    });
  } catch (error) {
    await releaseAttempt(db, { key: attempt.id, userId: uid });
    throw error;
  }
  deferPlayLog(defer, {
    attemptId: attempt.id,
    userId: uid,
    stageId: attempt.stageCode,
    outcome: 'fail',
    accepted: true,
    reason: null,
    claimedSeedLeft: null,
    serverElapsedMs: now.getTime() - attempt.issuedAt.getTime(),
    rawLog: input.log,
    at: now,
  });
  return { status: 200 };
}

export function fetchEndlessSummary(uid: string): Promise<PlaySummary> {
  return findPlaySummary(db, uid);
}
