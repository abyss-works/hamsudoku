// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PUZZLES } from '../../sudoku/model/puzzles';
import { useEndlessBoard } from './useEndlessBoard';

vi.mock('howler', () => ({ Howl: vi.fn(function () { return { play: vi.fn(), rate: vi.fn(), volume: vi.fn() }; }), Howler: { ctx: null } }));
afterEach(() => { cleanup(); });

const puzzle = PUZZLES[0];

function clock(start: number) {
  let value = start;
  return { now: () => value, advance: (ms: number) => { value += ms; } };
}

describe('useEndlessBoard 판 기록', () => {
  it('오답 보고에 보드를 연 시점부터의 조작 기록을 싣는다', () => {
    const time = clock(2000);
    const onWrong = vi.fn();
    const { result } = renderHook(() => useEndlessBoard(puzzle, onWrong, vi.fn(), time.now));

    time.advance(150);
    act(() => { result.current.tapCell(0, 1, 'single'); });
    time.advance(250);
    act(() => { result.current.toggleProbe(); });
    act(() => { result.current.toggleProbe(); });
    time.advance(600);
    act(() => { result.current.tapCell(0, 3, 'double'); });

    expect(onWrong).toHaveBeenCalledTimes(1);
    expect(onWrong).toHaveBeenCalledWith({
      version: 1,
      events: [[150, 'mark', 0, 1], [400, 'probe-on'], [400, 'probe-off'], [1000, 'wrong', 0, 3]],
    });
  });

  it('클리어 보고에 정답 착수까지 담은 기록을 싣는다', () => {
    const time = clock(0);
    const onFinish = vi.fn();
    const { result } = renderHook(() => useEndlessBoard(puzzle, vi.fn(), onFinish, time.now));

    act(() => {
      for (const [r, c] of puzzle.solution) {
        time.advance(100);
        result.current.tapCell(r, c, 'double');
      }
    });

    expect(onFinish).toHaveBeenCalledTimes(1);
    const log = onFinish.mock.calls[0][0];
    expect(log.events.filter(([, code]: [number, string]) => code === 'correct')).toEqual(
      puzzle.solution.map(([r, c], i) => [(i + 1) * 100, 'correct', r, c]),
    );
  });

  it('보드마다 새 기록을 시작한다', () => {
    const time = clock(0);
    const onWrong = vi.fn();
    const first = renderHook(() => useEndlessBoard(puzzle, onWrong, vi.fn(), time.now));
    act(() => { first.result.current.tapCell(0, 3, 'double'); });
    first.unmount();

    time.advance(5000);
    const second = renderHook(() => useEndlessBoard(puzzle, onWrong, vi.fn(), time.now));
    time.advance(70);
    act(() => { second.result.current.tapCell(4, 4, 'double'); });

    expect(onWrong).toHaveBeenLastCalledWith({ version: 1, events: [[70, 'wrong', 4, 4]] });
  });
});
