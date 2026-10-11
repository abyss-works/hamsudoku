// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OverlayProvider, useOverlay } from '../../ui/OverlayProvider';
import { useStageGame } from './useStageGame';
import type { Stage } from './catalog';

const testStage: Stage = {
  id: 'test-1',
  code: 'T1',
  title: '테스트 스테이지',
  locked: false,
  puzzle: {
    name: '테스트 1x1',
    size: 1,
    islands: [[0]],
    solution: [[0, 0]],
  },
};

function wrapper({ children }: { children: ReactNode }) {
  return <OverlayProvider initialScopeId="stage-test">{children}</OverlayProvider>;
}

describe('useStageGame overlay integration', () => {
  it('초기에는 clear overlay가 열려있지 않다가, 클리어 시 stage-clear 슬롯으로 clear 요청이 등록된다', () => {
    const onRecord = vi.fn();
    const { result } = renderHook(
      () => ({
        game: useStageGame(testStage, onRecord),
        overlay: useOverlay(),
      }),
      { wrapper },
    );

    expect(result.current.overlay.isOpen('clear', 'stage-clear')).toBe(false);

    // 1x1 퍼즐 클리어
    act(() => {
      result.current.game.tapCell(0, 0, 'double');
    });

    expect(result.current.game.cleared).toBe(true);
    expect(onRecord).toHaveBeenCalledWith('T1', expect.any(Number));
    expect(result.current.overlay.isOpen('clear', 'stage-clear')).toBe(true);
    expect(result.current.overlay.current('stage-clear')?.type).toBe('clear');
  });

  it('수동으로 clear를 닫은 뒤 rerender되어도 clear overlay가 다시 열리지 않는다', () => {
    const { result, rerender } = renderHook(
      () => ({
        game: useStageGame(testStage, vi.fn()),
        overlay: useOverlay(),
      }),
      { wrapper },
    );

    act(() => {
      result.current.game.tapCell(0, 0, 'double');
    });
    expect(result.current.overlay.isOpen('clear', 'stage-clear')).toBe(true);

    // 수동 닫기 (closeClear 또는 close 호출)
    act(() => {
      if ('closeClear' in result.current.game && typeof result.current.game.closeClear === 'function') {
        (result.current.game as any).closeClear();
      } else {
        result.current.overlay.close({ slot: 'stage-clear' });
      }
    });
    expect(result.current.overlay.isOpen('clear', 'stage-clear')).toBe(false);

    // 리렌더 후에도 다시 열리지 않아야 함
    rerender();
    expect(result.current.overlay.isOpen('clear', 'stage-clear')).toBe(false);
  });

  it('retry 호출 시 이전 clear overlay가 닫히고 새 판 수명으로 다시 클리어할 수 있다', () => {
    const { result } = renderHook(
      () => ({
        game: useStageGame(testStage, vi.fn()),
        overlay: useOverlay(),
      }),
      { wrapper },
    );

    act(() => {
      result.current.game.tapCell(0, 0, 'double');
    });
    expect(result.current.overlay.isOpen('clear', 'stage-clear')).toBe(true);

    // retry 호출
    act(() => {
      result.current.game.retry();
    });
    expect(result.current.game.cleared).toBe(false);
    expect(result.current.overlay.isOpen('clear', 'stage-clear')).toBe(false);

    // 다시 클리어 -> 새 판 수명에서 다시 open되어야 함
    act(() => {
      result.current.game.tapCell(0, 0, 'double');
    });
    expect(result.current.game.cleared).toBe(true);
    expect(result.current.overlay.isOpen('clear', 'stage-clear')).toBe(true);
  });
});
