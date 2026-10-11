import * as Sentry from '@sentry/nextjs';
import { EndlessApiError, nextStage } from '../api/endlessApi';
import { toPuzzle } from '../model/endlessBoard';
import {
  onStartFinally,
  onStartFailure,
  onStartPending,
  onStartSuccess,
  type EndlessSessionState,
} from '../model/endlessSessionState';

export interface StartContext {
  startingRef: { current: boolean };
  genRef: { current: number };
  roundRef?: { current: number };
  activeRef: { current: boolean };
  attemptKeyRef: { current: string | null };
  solutionRef: { current: [number, number][] };
  stageRef: { current: string | null };
  seedRef: { current: number };
  finishedRef: { current: boolean };
  cancelRetry: () => void;
  updateState: (updater: (prev: EndlessSessionState) => EndlessSessionState) => void;
}

export async function runStartWorkflow(ctx: StartContext): Promise<boolean> {
  if (!ctx.activeRef.current || ctx.startingRef.current) return false;
  ctx.startingRef.current = true;
  const gen = ctx.genRef.current + 1;
  ctx.genRef.current = gen;
  if (ctx.roundRef) {
    ctx.roundRef.current = gen;
  }

  ctx.cancelRetry();
  ctx.finishedRef.current = false;
  ctx.updateState(onStartPending);

  try {
    const next = await nextStage();
    if (!ctx.activeRef.current || ctx.genRef.current !== gen) return false;

    ctx.attemptKeyRef.current = next.attemptKey;
    ctx.solutionRef.current = next.solution;
    ctx.stageRef.current = next.stage.id;
    ctx.seedRef.current = 3;

    const puzzle = toPuzzle(next.stage, next.solution);
    ctx.updateState((prev) => onStartSuccess(prev, next.stage.id, puzzle, gen));
    return true;
  } catch (e) {
    if (!ctx.activeRef.current || ctx.genRef.current !== gen) return false;
    if (e instanceof EndlessApiError && e.status === 401) {
      ctx.updateState((prev) => onStartFailure(prev, '로그인이 필요해요.'));
    } else {
      Sentry.logger.warn('Endless stage load failed', {
        status: e instanceof EndlessApiError ? e.status : 0,
      });
      ctx.updateState((prev) => onStartFailure(prev, '무한모드를 불러오지 못했어요.'));
    }
    return false;
  } finally {
    if (ctx.activeRef.current && ctx.genRef.current === gen) {
      ctx.startingRef.current = false;
      ctx.updateState(onStartFinally);
    }
  }
}
