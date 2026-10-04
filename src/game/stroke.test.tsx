// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useHamSudoku } from './useHamSudoku';
import { PUZZLES } from './puzzles';

afterEach(cleanup);

const at = (cells: string[][], r: number, c: number) => cells[r][c];

describe('stroke', () => {
  it('잠금칸을 지나도 스트로크가 살아서 이후 빈칸이 칠해진다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.tapCell(0, 0, 'double');
    });
    expect(at(result.current.cells, 0, 2)).toBe('auto');
    act(() => {
      result.current.beginStroke(2, 2);
      result.current.strokeEnter(1, 2);
      result.current.strokeEnter(0, 2);
      result.current.strokeEnter(2, 4);
    });
    expect(at(result.current.cells, 2, 2)).toBe('mark');
    expect(at(result.current.cells, 1, 2)).toBe('mark');
    expect(at(result.current.cells, 0, 2)).toBe('auto');
    expect(at(result.current.cells, 2, 4)).toBe('mark');
  });

  it('되돌아가면 걸린 칸이 전부 되돌려진다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.beginStroke(0, 0);
      result.current.strokeEnter(0, 1);
      result.current.strokeEnter(0, 2);
      result.current.strokeEnter(0, 1);
    });
    expect(at(result.current.cells, 0, 0)).toBe('mark');
    expect(at(result.current.cells, 0, 1)).toBe('empty');
    expect(at(result.current.cells, 0, 2)).toBe('empty');
  });

  it('뛰어넘은 칸은 손대지 않는다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.beginStroke(0, 0);
      result.current.strokeEnter(0, 1);
      result.current.strokeEnter(0, 2);
      result.current.strokeEnter(0, 3);
      result.current.strokeEnter(0, 1);
    });
    expect(at(result.current.cells, 0, 0)).toBe('mark');
    expect(at(result.current.cells, 0, 1)).toBe('empty');
    expect(at(result.current.cells, 0, 2)).toBe('mark');
    expect(at(result.current.cells, 0, 3)).toBe('empty');
  });

  it('움직임 없이 끝나면 탭으로 취급한다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    let engaged = true;
    act(() => {
      result.current.beginStroke(0, 0);
      engaged = result.current.endStroke();
    });
    expect(engaged).toBe(false);
    expect(at(result.current.cells, 0, 0)).toBe('empty');
  });

  it('같은 칸에서 맴돌아도 한 번만 바뀐다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.beginStroke(0, 0);
      result.current.strokeEnter(0, 1);
      result.current.strokeEnter(0, 1);
      result.current.strokeEnter(0, 1);
    });
    expect(at(result.current.cells, 0, 0)).toBe('mark');
    expect(at(result.current.cells, 0, 1)).toBe('mark');
  });

  it('되돌린 칸을 지나가면 다시 칠해진다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.beginStroke(0, 0);
      result.current.strokeEnter(0, 1);
      result.current.strokeEnter(0, 2);
      result.current.strokeEnter(0, 1);
      result.current.strokeEnter(0, 0);
      result.current.strokeEnter(0, 1);
    });
    expect(at(result.current.cells, 0, 0)).toBe('mark');
    expect(at(result.current.cells, 0, 1)).toBe('mark');
    expect(at(result.current.cells, 0, 2)).toBe('empty');
  });
});
