// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OverlayProvider, useOverlay } from '../../ui/OverlayProvider';
import { useEndlessGame } from './useEndlessGame';

const sessionActions = vi.hoisted(() => ({
  start: vi.fn().mockResolvedValue(undefined),
  finish: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./useEndlessSession', () => ({
  useEndlessSession: () => ({
    ...sessionActions,
    stageId: 'round-1',
    roundId: 1,
    puzzle: { size: 1, islands: [[0]] },
    phase: 'gameover',
    mirror: { wallet: { balance: 0 } },
    seeds: 0,
    error: null,
    finishResult: null,
    starting: false,
    submitting: false,
  }),
}));

describe('무한모드 표시 요청의 전이 수명', () => {
  afterEach(cleanup);

  it('같은 게임오버 상태에서 요청을 닫아도 표시 상태 갱신만으로 다시 열리지 않는다', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <OverlayProvider>{children}</OverlayProvider>;
    const { result } = renderHook(() => {
      const game = useEndlessGame();
      const overlay = useOverlay();
      return { game, overlay };
    }, { wrapper });
    expect(result.current.overlay.isOpen('gameover', 'endless-gameover')).toBe(true);
    act(() => result.current.overlay.close({ slot: 'endless-gameover' }));
    expect(result.current.overlay.isOpen('gameover', 'endless-gameover')).toBe(false);
  });
});
