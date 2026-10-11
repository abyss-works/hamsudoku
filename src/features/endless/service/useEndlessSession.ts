import { useCallback, useEffect, useRef, useState } from 'react';
import type { EndlessMirror } from '../../../shared/endless';
import { seasonId } from '../../../shared/season';
import { loadMirror, storeMirror } from '../api/mirrorApi';
import type { Puzzle } from '../../sudoku/model/puzzles';
import {
  createInitialEndlessSessionState,
  type EndlessPhase,
  type EndlessSessionState,
} from '../model/endlessSessionState';
import type { RetryJob } from './endlessRetryJob';
import { runStartWorkflow } from './endlessStartWorkflow';
import { runWrongWorkflow } from './endlessWrongWorkflow';
import { runSubmitWorkflow, RETRY_DELAY_MS } from './endlessSubmitWorkflow';

export type { EndlessPhase } from '../model/endlessSessionState';

export interface EndlessSession {
  puzzle: Puzzle | null;
  stageId: string | null;
  roundId: number;
  seeds: number;
  phase: EndlessPhase;
  mirror: EndlessMirror;
  error: string | null;
  finishResult: { ok: boolean; earned: number } | null;
  submitting: boolean;
  starting: boolean;
  start(): Promise<boolean>;
  reportWrong(): void;
  finish(): Promise<void>;
}

export { RETRY_DELAY_MS };

export function useEndlessSession(): EndlessSession {
  const [state, setState] = useState<EndlessSessionState>(() =>
    createInitialEndlessSessionState(loadMirror(seasonId(new Date()))),
  );

  const attemptKeyRef = useRef<string | null>(null);
  const solutionRef = useRef<[number, number][]>([]);
  const seedRef = useRef(3);
  const stageRef = useRef<string | null>(null);
  const roundRef = useRef(0);
  const mirrorRef = useRef(state.mirror);
  const finishedRef = useRef(false);
  const genRef = useRef(0);
  const startingRef = useRef(false);
  const activeRef = useRef(true);
  const retryRef = useRef<RetryJob | null>(null);

  const cancelRetry = useCallback(() => {
    if (!retryRef.current) return;
    retryRef.current.cancel();
    retryRef.current = null;
  }, []);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      cancelRetry();
    };
  }, [cancelRetry]);

  const setMirrorBoth = useCallback((next: EndlessMirror) => {
    mirrorRef.current = next;
    storeMirror(next);
  }, []);

  const start = useCallback(async () => {
    return await runStartWorkflow({
      startingRef,
      genRef,
      roundRef,
      activeRef,
      attemptKeyRef,
      solutionRef,
      stageRef,
      seedRef,
      finishedRef,
      cancelRetry,
      updateState: setState,
    });
  }, [cancelRetry]);

  const boundStageId = state.stageId;
  const boundRoundId = state.roundId;

  const reportWrong = useCallback(() => {
    runWrongWorkflow(
      {
        activeRef,
        seedRef,
        stageRef,
        roundRef,
        attemptKeyRef,
        mirrorRef,
        setMirrorBoth,
        updateState: setState,
      },
      boundStageId,
      boundRoundId,
    );
  }, [boundStageId, boundRoundId, setMirrorBoth]);

  const finish = useCallback(async () => {
    await runSubmitWorkflow({
      boundStageId,
      boundRoundId,
      finishedRef,
      attemptKeyRef,
      stageRef,
      roundRef,
      solutionRef,
      seedRef,
      mirrorRef,
      genRef,
      activeRef,
      retryRef,
      setMirrorBoth,
      updateState: setState,
    });
  }, [boundStageId, boundRoundId, setMirrorBoth]);

  return {
    puzzle: state.puzzle,
    stageId: state.stageId,
    roundId: state.roundId,
    seeds: state.seeds,
    phase: state.phase,
    mirror: state.mirror,
    error: state.error,
    finishResult: state.finishResult,
    submitting: state.submitting,
    starting: state.starting,
    start,
    reportWrong,
    finish,
  };
}
