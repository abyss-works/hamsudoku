import { describe, expect, it } from 'vitest';
import {
  createInitialEndlessSessionState,
  onStartPending,
  onStartSuccess,
  onStartFailure,
  onReportWrong,
  onFinishOptimistic,
  onFinishSuccess,
  onFinishFailure,
  onFinishNetworkFailure,
} from './endlessSessionState';
import type { EndlessMirror } from '../../shared/endless';
import type { Puzzle } from '../sudoku/model/puzzles';

const initialMirror: EndlessMirror = {
  v: 1,
  season: '2026-w40',
  wallet: { balance: 0 },
  streak: { current: 0, best: 0 },
  clearedIds: [],
};

const dummyPuzzle: Puzzle = {
  name: 'test',
  size: 5,
  islands: Array.from({ length: 5 }, () => Array(5).fill(0)),
  solution: [[0, 0], [1, 1]],
};

describe('endlessSessionState pure transitions', () => {
  it('초기 상태는 idle phase와 seeds 3을 갖는다', () => {
    const s = createInitialEndlessSessionState(initialMirror);
    expect(s.phase).toBe('idle');
    expect(s.seeds).toBe(3);
    expect(s.stageId).toBeNull();
    expect(s.roundId).toBe(0);
    expect(s.puzzle).toBeNull();
    expect(s.starting).toBe(false);
    expect(s.submitting).toBe(false);
  });

  it('onStartPending은 starting을 true로 바꾸고 이전 결과를 정리한다', () => {
    const s = createInitialEndlessSessionState(initialMirror);
    const pending = onStartPending(s);
    expect(pending.starting).toBe(true);
    expect(pending.error).toBeNull();
    expect(pending.finishResult).toBeNull();
  });

  it('onStartSuccess는 stageId, puzzle, seeds 3, playing phase를 설정한다', () => {
    const s = onStartPending(createInitialEndlessSessionState(initialMirror));
    const next = onStartSuccess(s, 'e-1', dummyPuzzle);
    expect(next.stageId).toBe('e-1');
    expect(next.puzzle).toBe(dummyPuzzle);
    expect(next.roundId).toBe(1);
    expect(next.seeds).toBe(3);
    expect(next.phase).toBe('playing');
    expect(next.starting).toBe(false);
  });

  it('onStartFailure는 에러 메시지를 설정하고 starting을 false로 변경한다', () => {
    const s = onStartPending(createInitialEndlessSessionState(initialMirror));
    const next = onStartFailure(s, '무한모드를 불러오지 못했어요.');
    expect(next.error).toBe('무한모드를 불러오지 못했어요.');
    expect(next.starting).toBe(false);
  });

  it('onReportWrong은 seeds를 갱신하고 gameOver면 phase를 변경한다', () => {
    const s = onStartSuccess(createInitialEndlessSessionState(initialMirror), 'e-1', dummyPuzzle);
    const wrong1 = onReportWrong(s, 2, false, initialMirror);
    expect(wrong1.seeds).toBe(2);
    expect(wrong1.phase).toBe('playing');

    const wrongOver = onReportWrong(wrong1, 0, true, initialMirror);
    expect(wrongOver.seeds).toBe(0);
    expect(wrongOver.phase).toBe('gameover');
  });

  it('onFinishOptimistic 및 onFinishSuccess 전이', () => {
    const s = onStartSuccess(createInitialEndlessSessionState(initialMirror), 'e-1', dummyPuzzle);
    const optimisticMirror = { ...initialMirror, wallet: { balance: 3 } };
    const opt = onFinishOptimistic(s, optimisticMirror);
    expect(opt.submitting).toBe(true);
    expect(opt.mirror.wallet.balance).toBe(3);

    const succ = onFinishSuccess(opt, optimisticMirror, 3);
    expect(succ.submitting).toBe(false);
    expect(succ.phase).toBe('cleared');
    expect(succ.finishResult).toEqual({ ok: true, earned: 3 });
  });

  it('onFinishFailure는 롤백 mirror와 에러를 설정한다', () => {
    const s = onStartSuccess(createInitialEndlessSessionState(initialMirror), 'e-1', dummyPuzzle);
    const opt = onFinishOptimistic(s, { ...initialMirror, wallet: { balance: 3 } });
    const fail = onFinishFailure(opt, initialMirror, '실패');
    expect(fail.mirror.wallet.balance).toBe(0);
    expect(fail.error).toBe('실패');
    expect(fail.finishResult).toEqual({ ok: false, earned: 0 });
    expect(fail.phase).toBe('cleared');
    expect(fail.submitting).toBe(false);
  });

  it('onFinishNetworkFailure는 optimistic mirror를 유지하고 에러를 설정한다', () => {
    const s = onStartSuccess(createInitialEndlessSessionState(initialMirror), 'e-1', dummyPuzzle);
    const opt = onFinishOptimistic(s, { ...initialMirror, wallet: { balance: 3 } });
    const fail = onFinishNetworkFailure(opt, '기록을 저장하지 못했어요.');
    expect(fail.mirror.wallet.balance).toBe(3);
    expect(fail.error).toBe('기록을 저장하지 못했어요.');
    expect(fail.finishResult).toEqual({ ok: false, earned: 0 });
    expect(fail.phase).toBe('cleared');
    expect(fail.submitting).toBe(false);
  });
});
