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

it('조작 결과를 오답·클리어 보고보다 먼저 전달한다', () => {
  const calls: unknown[] = [];
  const { result } = renderHook(() =>
    useHamSudoku(PUZZLES[0], {
      onWrong: () => calls.push('onWrong'),
      onClear: () => calls.push('onClear'),
      onTransition: (action, sounds) => calls.push([action, [...sounds]]),
    }),
  );
  act(() => { result.current.tapCell(0, 3, 'double'); });
  expect(calls).toEqual([[{ type: 'tap', r: 0, c: 3, kind: 'double' }, ['wrong']], 'onWrong']);
  calls.length = 0;
  act(() => { result.current.setProbeActive(true); result.current.setProbeActive(false); });
  expect(calls).toEqual([[{ type: 'probe', on: true }, []], [{ type: 'probe', on: false }, []]]);
  calls.length = 0;
  act(() => { for (const [r, c] of PUZZLES[0].solution) result.current.tapCell(r, c, 'double'); });
  expect(calls.at(-2)).toEqual([{ type: 'tap', r: PUZZLES[0].solution.at(-1)![0], c: PUZZLES[0].solution.at(-1)![1], kind: 'double' }, ['correct']]);
  expect(calls.at(-1)).toBe('onClear');
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

it('press는 대기 중인 싱글탭 취소자를 전달하고, 취소하면 single이 확정되지 않는다', async () => {
  const cell = await import('../service/useCellInteraction');
  vi.useFakeTimers();
  const onTap = vi.fn();
  const onPress = vi.fn<(cancelPendingTap: () => void) => void>();
  const { result } = renderHook(() => cell.useCellInteraction(onTap, onPress));
  act(() => result.current.handleClick());
  act(() => result.current.handlePress({ pointerType: 'mouse' } as never));
  expect(onPress).toHaveBeenCalledTimes(1);
  const cancel = onPress.mock.calls[0][0];
  act(() => cancel());
  act(() => vi.runAllTimers());
  expect(onTap).not.toHaveBeenCalled();
});
