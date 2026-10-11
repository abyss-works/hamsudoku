import { describe, expect, it, vi } from 'vitest';
import { runWrongWorkflow, type WrongContext } from './endlessWrongWorkflow';
import type { EndlessMirror } from '../../shared/endless';
import { createInitialEndlessSessionState, type EndlessSessionState } from './endlessSessionState';

vi.mock('../../platform/audio/sound', () => ({
  playGameOverSound: vi.fn(),
}));
vi.mock('./endlessApi', () => ({
  reportFail: vi.fn(),
}));

const baseMirror: EndlessMirror = {
  v: 1,
  season: '2026-w40',
  wallet: { balance: 10 },
  streak: { current: 2, best: 5 },
  clearedIds: ['e-0'],
};

describe('runWrongWorkflow updater purity', () => {
  it('비-gameover 오답은 updater 지연 실행 시 mutable ref가 바뀌어도 prev.mirror를 보존한다', () => {
    let capturedUpdater: ((prev: EndlessSessionState) => EndlessSessionState) | null = null;
    const mirrorRef = { current: { ...baseMirror } };
    const ctx: WrongContext = {
      activeRef: { current: true },
      seedRef: { current: 3 },
      stageRef: { current: 'e-1' },
      attemptKeyRef: { current: 'k1' },
      mirrorRef,
      setMirrorBoth: vi.fn(),
      updateState: (updater) => {
        capturedUpdater = updater;
      },
    };

    runWrongWorkflow(ctx, 'e-1');
    expect(ctx.seedRef.current).toBe(2);
    expect(capturedUpdater).not.toBeNull();

    // updater 실행 전 외부에서 mutable ref를 다른 값으로 변조
    const corruptedMirror: EndlessMirror = {
      v: 1,
      season: '2026-w99',
      wallet: { balance: 999 },
      streak: { current: 99, best: 99 },
      clearedIds: ['corrupted'],
    };
    mirrorRef.current = corruptedMirror;

    const prevState = createInitialEndlessSessionState(baseMirror);
    const nextState = capturedUpdater!(prevState);

    // prev.mirror(baseMirror)가 보존되어야 하며, corruptedMirror로 덮어쓰여서는 안 됨!
    expect(nextState.mirror).toEqual(baseMirror);
    expect(nextState.mirror.wallet.balance).toBe(10);
  });
});
