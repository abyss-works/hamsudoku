// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useHamSudoku } from '../service/useHamSudoku';
import { PUZZLES } from '../model/puzzles';

vi.mock('howler', () => ({ Howl: vi.fn(function () { return { play: vi.fn(), rate: vi.fn(), volume: vi.fn() }; }), Howler: { ctx: null } }));
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('오답과 클리어를 액션 처리 때 한 번만 보고한다', () => {
  const onWrong = vi.fn(); const onClear = vi.fn();
  const { result, rerender } = renderHook(() => useHamSudoku(PUZZLES[0], { onWrong, onClear }));
  act(() => { result.current.tapCell(0, 3, 'double'); result.current.tapCell(0, 3, 'double'); });
  expect(onWrong).toHaveBeenCalledTimes(1);
  act(() => { for (const [r, c] of PUZZLES[0].solution) result.current.tapCell(r, c, 'double'); });
  expect(onClear).toHaveBeenCalledTimes(1);
  rerender();
  expect(onClear).toHaveBeenCalledTimes(1);
});

it('지연 탭은 최신 핸들러를 사용하고 unmount 뒤에는 실행되지 않는다', async () => {
  const cell = await import('../service/useCellInteraction');
  vi.useFakeTimers();
  const old = vi.fn(); const next = vi.fn();
  const { result, rerender, unmount } = renderHook(({ onTap }) => cell.useCellInteraction(onTap, () => {}), { initialProps: { onTap: old } });
  act(() => result.current.handleClick());
  rerender({ onTap: next });
  act(() => vi.runAllTimers());
  expect(old).not.toHaveBeenCalled(); expect(next).toHaveBeenCalledWith('single');
  act(() => result.current.handleClick());
  unmount();
  vi.runAllTimers();
  expect(next).toHaveBeenCalledTimes(1);
});

it('두 클릭 이후 브라우저 dblclick은 같은 확정을 반복하지 않는다', async () => {
  const cell = await import('../service/useCellInteraction');
  vi.useFakeTimers();
  const onTap = vi.fn();
  const { result } = renderHook(() => cell.useCellInteraction(onTap, () => {}));
  act(() => { result.current.handleClick(); result.current.handleClick(); result.current.handleDoubleClick(); });
  expect(onTap.mock.calls).toEqual([['double']]);
});
