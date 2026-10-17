import { useCallback, useEffect, useRef, useState } from 'react';
import type { EndlessMirror, PlayLog } from '../../../shared/endless';
import { seasonId } from '../../../shared/season';
import { loadStoredMirror, storeMirror } from '../api/mirrorApi';
import { emptyMirror } from '../../../shared/endlessMirrorRules';
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
  /** 새 판을 시작한다. stageId를 주면 그 판에 다시 도전한다. */
  start(stageId?: string): Promise<boolean>;
  /** 오답을 반영한다. 판 기록은 게임오버 실패 보고에 싣는다. */
  reportWrong(log?: PlayLog): void;
  /** 클리어를 제출한다. 판 기록은 클리어 제출에 싣는다. */
  finish(log?: PlayLog): Promise<void>;
}

export { RETRY_DELAY_MS };

export interface EndlessSessionOptions {
  /** 미러의 소유 계정. 없으면 게스트 저장분을 사용한다. */
  owner?: string | null;
  /** 소유 계정의 저장 미러가 없을 때 초기값으로 쓰는 서버 요약. */
  seed?: { balance: number; streak: { current: number; best: number } };
}

// 초기 미러: 소유 계정의 저장분 → 서버 요약 → 빈 미러 순서로 고른다.
// 다른 계정이나 게스트의 저장분을 현재 계정 값으로 해석하지 않는다.
function initialMirror(options: EndlessSessionOptions): EndlessMirror {
  const season = seasonId(new Date());
  const stored = loadStoredMirror(season, options.owner);
  if (stored) return stored;
  const empty = emptyMirror(season);
  if (!options.seed) return empty;
  return { ...empty, wallet: { balance: options.seed.balance }, streak: { ...options.seed.streak } };
}

export function useEndlessSession(options: EndlessSessionOptions = {}): EndlessSession {
  const ownerRef = useRef(options.owner ?? null);
  ownerRef.current = options.owner ?? null;
  const [state, setState] = useState<EndlessSessionState>(() =>
    createInitialEndlessSessionState(initialMirror(options)),
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
    storeMirror(next, ownerRef.current);
  }, []);

  const start = useCallback(async (stageId?: string) => {
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
    }, stageId);
  }, [cancelRetry]);

  const boundStageId = state.stageId;
  const boundRoundId = state.roundId;

  const reportWrong = useCallback((log?: PlayLog) => {
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
      log,
    );
  }, [boundStageId, boundRoundId, setMirrorBoth]);

  const finish = useCallback(async (log?: PlayLog) => {
    await runSubmitWorkflow({
      boundStageId,
      boundRoundId,
      log,
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
