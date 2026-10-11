import type { EndlessMirror } from '../../shared/endless';
import type { Puzzle } from '../sudoku/model/puzzles';

export type EndlessPhase = 'idle' | 'playing' | 'gameover' | 'cleared';

export interface EndlessFinishResult {
  ok: boolean;
  earned: number;
}

export interface EndlessSessionState {
  puzzle: Puzzle | null;
  stageId: string | null;
  roundId: number;
  seeds: number;
  phase: EndlessPhase;
  mirror: EndlessMirror;
  error: string | null;
  finishResult: EndlessFinishResult | null;
  submitting: boolean;
  starting: boolean;
}

export function createInitialEndlessSessionState(initialMirror: EndlessMirror): EndlessSessionState {
  return {
    puzzle: null,
    stageId: null,
    roundId: 0,
    seeds: 3,
    phase: 'idle',
    mirror: initialMirror,
    error: null,
    finishResult: null,
    submitting: false,
    starting: false,
  };
}

export function onStartPending(prev: EndlessSessionState): EndlessSessionState {
  return {
    ...prev,
    submitting: false,
    error: null,
    starting: true,
  };
}

export function onStartSuccess(
  prev: EndlessSessionState,
  stageId: string,
  puzzle: Puzzle,
  roundId?: number,
): EndlessSessionState {
  return {
    ...prev,
    stageId,
    puzzle,
    roundId: roundId ?? prev.roundId + 1,
    seeds: 3,
    phase: 'playing',
    finishResult: null,
    starting: false,
  };
}

export function onStartFailure(prev: EndlessSessionState, error: string): EndlessSessionState {
  return {
    ...prev,
    error,
    starting: false,
  };
}

export function onStartFinally(prev: EndlessSessionState): EndlessSessionState {
  return {
    ...prev,
    starting: false,
  };
}

export function onReportWrong(
  prev: EndlessSessionState,
  nextSeeds: number,
  isGameOver: boolean,
  gameOverMirror?: EndlessMirror,
): EndlessSessionState {
  return {
    ...prev,
    seeds: nextSeeds,
    phase: isGameOver ? 'gameover' : prev.phase,
    mirror: isGameOver && gameOverMirror ? gameOverMirror : prev.mirror,
  };
}

export function onFinishOptimistic(
  prev: EndlessSessionState,
  optimisticMirror: EndlessMirror,
): EndlessSessionState {
  return {
    ...prev,
    mirror: optimisticMirror,
    finishResult: null,
    submitting: true,
  };
}

export function onFinishSuccess(
  prev: EndlessSessionState,
  nextMirror: EndlessMirror,
  earned: number,
): EndlessSessionState {
  return {
    ...prev,
    mirror: nextMirror,
    finishResult: { ok: true, earned },
    submitting: false,
    phase: 'cleared',
  };
}

export function onFinishFailure(
  prev: EndlessSessionState,
  rollbackMirror: EndlessMirror,
  error: string,
): EndlessSessionState {
  return {
    ...prev,
    mirror: rollbackMirror,
    error,
    finishResult: { ok: false, earned: 0 },
    submitting: false,
    phase: 'cleared',
  };
}

export function onFinishNetworkFailure(
  prev: EndlessSessionState,
  error: string,
): EndlessSessionState {
  return {
    ...prev,
    error,
    finishResult: { ok: false, earned: 0 },
    submitting: false,
    phase: 'cleared',
  };
}
