// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OverlayProvider, useOverlay } from '../../ui/OverlayProvider';
import { LoadingProvider } from '../../ui/LoadingProvider';
import { useEndlessGame } from './useEndlessGame';
import * as endlessSessionModule from './useEndlessSession';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <LoadingProvider>
      <OverlayProvider initialScopeId="endless">
        {children}
      </OverlayProvider>
    </LoadingProvider>
  );
}

describe('useEndlessGame overlay integration', () => {
  it('finishBoard 호출 시 endless-clear 슬롯으로 clear overlay가 즉시 열린다', () => {
    let mockPhase: endlessSessionModule.EndlessPhase = 'playing';
    const mockFinish = vi.fn().mockResolvedValue(undefined);
    const mockStart = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(endlessSessionModule, 'useEndlessSession').mockReturnValue({
      puzzle: { name: 'test', size: 1, islands: [[0]], solution: [[0, 0]] },
      stageId: 'stg-1',
      roundId: 1,
      seeds: 3,
      phase: mockPhase,
      mirror: { wallet: { balance: 10 } } as any,
      error: null,
      finishResult: null,
      submitting: false,
      starting: false,
      start: mockStart,
      reportWrong: vi.fn(),
      finish: mockFinish,
    });

    const { result } = renderHook(
      () => ({
        game: useEndlessGame(),
        overlay: useOverlay(),
      }),
      { wrapper },
    );

    expect(result.current.overlay.isOpen('clear', 'endless-clear')).toBe(false);

    // finishBoard 호출
    act(() => {
      result.current.game.finishBoard();
    });

    expect(mockFinish).toHaveBeenCalledOnce();
    expect(result.current.overlay.isOpen('clear', 'endless-clear')).toBe(true);
    expect(result.current.overlay.current('endless-clear')?.type).toBe('clear');
  });

  it('session.phase가 gameover가 되면 endless-clear는 닫히고 endless-gameover 슬롯이 열린다', () => {
    let mockPhase: endlessSessionModule.EndlessPhase = 'playing';

    vi.spyOn(endlessSessionModule, 'useEndlessSession').mockImplementation(() => ({
      puzzle: { name: 'test', size: 1, islands: [[0]], solution: [[0, 0]] },
      stageId: 'stg-1',
      roundId: 1,
      seeds: 0,
      phase: mockPhase,
      mirror: { wallet: { balance: 10 } } as any,
      error: '씨앗을 다 썼어요',
      finishResult: null,
      submitting: false,
      starting: false,
      start: vi.fn().mockResolvedValue(undefined),
      reportWrong: vi.fn(),
      finish: vi.fn().mockResolvedValue(undefined),
    }));

    const { result, rerender } = renderHook(
      () => ({
        game: useEndlessGame(),
        overlay: useOverlay(),
      }),
      { wrapper },
    );

    // 먼저 clear가 열려있었다고 가정
    act(() => {
      result.current.game.finishBoard();
    });
    expect(result.current.overlay.isOpen('clear', 'endless-clear')).toBe(true);

    // phase를 gameover로 전환 후 리렌더
    mockPhase = 'gameover';
    rerender();

    expect(result.current.overlay.isOpen('clear', 'endless-clear')).toBe(false);
    expect(result.current.overlay.isOpen('gameover', 'endless-gameover')).toBe(true);
  });

  it('next 호출 시 이전 clear와 gameover 오버레이가 모두 닫힌다', () => {
    let mockPhase: endlessSessionModule.EndlessPhase = 'gameover';
    const mockStart = vi.fn().mockImplementation(async () => {
      mockPhase = 'playing';
    });
    vi.spyOn(endlessSessionModule, 'useEndlessSession').mockImplementation(() => ({
      puzzle: { name: 'test', size: 1, islands: [[0]], solution: [[0, 0]] },
      stageId: 'stg-1',
      roundId: 1,
      seeds: 3,
      phase: mockPhase,
      mirror: { wallet: { balance: 10 } } as any,
      error: null,
      finishResult: null,
      submitting: false,
      starting: false,
      start: mockStart,
      reportWrong: vi.fn(),
      finish: vi.fn().mockResolvedValue(undefined),
    }));

    const { result, rerender } = renderHook(
      () => ({
        game: useEndlessGame(),
        overlay: useOverlay(),
      }),
      { wrapper },
    );

    // gameover 열림 확인
    expect(result.current.overlay.isOpen('gameover', 'endless-gameover')).toBe(true);

    // next 호출
    act(() => {
      result.current.game.next();
    });
    rerender();

    expect(mockStart).toHaveBeenCalled();
    expect(result.current.overlay.isOpen('clear', 'endless-clear')).toBe(false);
    expect(result.current.overlay.isOpen('gameover', 'endless-gameover')).toBe(false);
  });

  it('next() 호출 후 phase가 여전히 gameover인 동안 관련없는 리렌더가 일어나도 gameover 오버레이가 재개방되지 않는다', () => {
    const mockPhase: endlessSessionModule.EndlessPhase = 'gameover';
    const mockStart = vi.fn().mockImplementation(() => new Promise(() => {}));
    vi.spyOn(endlessSessionModule, 'useEndlessSession').mockImplementation(() => ({
      puzzle: { name: 'test', size: 1, islands: [[0]], solution: [[0, 0]] },
      stageId: 'stg-1',
      roundId: 1,
      seeds: 0,
      phase: mockPhase,
      mirror: { wallet: { balance: 10 } } as any,
      error: '씨앗 부족',
      finishResult: null,
      submitting: false,
      starting: false,
      start: mockStart,
      reportWrong: vi.fn(),
      finish: vi.fn().mockResolvedValue(undefined),
    }));

    const { result, rerender } = renderHook(
      () => ({
        game: useEndlessGame(),
        overlay: useOverlay(),
      }),
      { wrapper },
    );

    expect(result.current.overlay.isOpen('gameover', 'endless-gameover')).toBe(true);

    // next 호출
    act(() => {
      result.current.game.next();
    });
    expect(result.current.overlay.isOpen('gameover', 'endless-gameover')).toBe(false);

    // phase는 여전히 gameover인 상태에서 리렌더링 발생
    rerender();
    expect(result.current.overlay.isOpen('gameover', 'endless-gameover')).toBe(false);
  });

  it('이전 판의 finishBoard와 reportWrong 콜백이 새 판으로 전이된 후 실행되면 무시된다', () => {
    let currentStageId = 'round-1';
    let currentRoundId = 1;
    const mockFinish = vi.fn().mockResolvedValue(undefined);
    const mockReportWrong = vi.fn();
    const mockStart = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(endlessSessionModule, 'useEndlessSession').mockImplementation(() => ({
      puzzle: { name: 'test', size: 1, islands: [[0]], solution: [[0, 0]] },
      stageId: currentStageId,
      roundId: currentRoundId,
      seeds: 3,
      phase: 'playing',
      mirror: { wallet: { balance: 10 } } as any,
      error: null,
      finishResult: null,
      submitting: false,
      starting: false,
      start: mockStart,
      reportWrong: mockReportWrong,
      finish: mockFinish,
    }));

    const { result, rerender } = renderHook(
      () => ({
        game: useEndlessGame(),
        overlay: useOverlay(),
      }),
      { wrapper },
    );

    // round-1의 액션 캡처
    const round1Finish = result.current.game.finishBoard;
    const round1Wrong = result.current.game.reportWrong;
    const round1Next = result.current.game.next;

    // round-2로 새 판 시작
    currentStageId = 'round-2';
    currentRoundId = 2;
    rerender();
    mockStart.mockClear();
    mockReportWrong.mockClear();
    mockFinish.mockClear();

    // 이전 판 액션 실행 시도
    act(() => {
      round1Wrong();
      round1Finish();
      round1Next();
    });

    // 새 판에서는 호출되지 않아야 함
    expect(mockReportWrong).not.toHaveBeenCalled();
    expect(mockFinish).not.toHaveBeenCalled();
    expect(mockStart).not.toHaveBeenCalled();
  });
});
