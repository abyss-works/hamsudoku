import { EndlessApiError, submitClear } from './endlessApi';
import { applyClear, applyClearResponse, markCleared } from '../../shared/endlessMirrorRules';
import { playClearSound } from '../../platform/audio/sound';
import type { EndlessMirror } from '../../shared/endless';
import { createRetryJob, type RetryJob } from './endlessRetryJob';
import {
  onFinishFailure,
  onFinishNetworkFailure,
  onFinishOptimistic,
  onFinishSuccess,
  type EndlessSessionState,
} from './endlessSessionState';

export const RETRY_DELAY_MS = 3000;

export interface SubmitContext {
  boundStageId: string | null;
  boundRoundId?: number;
  finishedRef: { current: boolean };
  attemptKeyRef: { current: string | null };
  stageRef: { current: string | null };
  roundRef?: { current: number };
  solutionRef: { current: [number, number][] };
  seedRef: { current: number };
  mirrorRef: { current: EndlessMirror };
  genRef: { current: number };
  activeRef: { current: boolean };
  retryRef: { current: RetryJob | null };
  setMirrorBoth: (next: EndlessMirror) => void;
  updateState: (updater: (prev: EndlessSessionState) => EndlessSessionState) => void;
}

export async function runSubmitWorkflow(ctx: SubmitContext): Promise<void> {
  if (!ctx.activeRef.current) return;
  if (!ctx.boundStageId || ctx.boundStageId !== ctx.stageRef.current) return;
  if (ctx.boundRoundId !== undefined && (ctx.boundRoundId === 0 || ctx.boundRoundId !== ctx.roundRef?.current)) return;
  if (ctx.finishedRef.current) return;

  const key = ctx.attemptKeyRef.current;
  const sid = ctx.stageRef.current;
  if (!key || !sid) return;

  ctx.finishedRef.current = true;
  const gen = ctx.genRef.current;
  const isStale = () => !ctx.activeRef.current || ctx.genRef.current !== gen;

  const left = ctx.seedRef.current;
  const previous = ctx.mirrorRef.current;
  const optimistic = applyClear(markCleared(previous, sid), left);

  ctx.setMirrorBoth(optimistic);
  ctx.updateState((prev) => onFinishOptimistic(prev, optimistic));

  const submit = () =>
    submitClear({
      attemptKey: key,
      stageId: sid,
      solution: ctx.solutionRef.current,
      seedLeft: left,
    });

  const acceptResponse = (res: Awaited<ReturnType<typeof submitClear>>) => {
    if (res.ok) {
      const nextMirror = applyClearResponse(optimistic, res);
      ctx.setMirrorBoth(nextMirror);
      ctx.updateState((prev) => onFinishSuccess(prev, nextMirror, res.earned));
      playClearSound(res.earned);
    } else {
      ctx.setMirrorBoth(previous);
      ctx.updateState((prev) => onFinishFailure(prev, previous, res.reason));
      playClearSound();
    }
  };

  try {
    try {
      const res = await submit();
      if (isStale()) return;
      acceptResponse(res);
    } catch (e) {
      if (isStale()) return;
      if (e instanceof EndlessApiError) {
        ctx.setMirrorBoth(previous);
        const errorMsg = e.status === 401 ? '로그인이 필요해요.' : '기록을 저장하지 못했어요.';
        ctx.updateState((prev) => onFinishFailure(prev, previous, errorMsg));
        playClearSound();
        return;
      }

      const retryJob = createRetryJob(RETRY_DELAY_MS);
      ctx.retryRef.current = retryJob;
      await retryJob.promise;
      ctx.retryRef.current = null;

      if (isStale()) return;

      try {
        const retryRes = await submit();
        if (isStale()) return;
        acceptResponse(retryRes);
      } catch {
        if (isStale()) return;
        ctx.updateState((prev) => onFinishNetworkFailure(prev, '기록을 저장하지 못했어요.'));
        playClearSound();
      }
    }
  } finally {
    if (!isStale()) {
      ctx.updateState((prev) => ({ ...prev, submitting: false }));
    }
  }
}
