// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useHamSudoku } from './useHamSudoku';
import { PUZZLES } from './puzzles';

afterEach(cleanup);

const at = (cells: string[][], r: number, c: number) => cells[r][c];

describe('stroke', () => {
  it('지나간 빈칸은 마크가 되고 마크는 빈칸이 된다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.tapCell(0, 1, 'single');
    });
    expect(at(result.current.cells, 0, 1)).toBe('mark');
    act(() => {
      result.current.beginStroke(0, 0);
      result.current.strokeEnter(0, 1);
      result.current.strokeEnter(0, 2);
    });
    expect(at(result.current.cells, 0, 0)).toBe('mark');
    expect(at(result.current.cells, 0, 1)).toBe('empty');
    expect(at(result.current.cells, 0, 2)).toBe('mark');
  });

  it('햄스터·자동·오답 칸은 지나가도 바뀌지 않고 스트로크는 이어진다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.tapCell(0, 0, 'double'); // 정답 → 햄스터, (0,2)는 자동
      result.current.tapCell(4, 4, 'double'); // 오답 → 빨강 고정
    });
    expect(at(result.current.cells, 0, 0)).toBe('hamster');
    expect(at(result.current.cells, 0, 2)).toBe('auto');
    expect(at(result.current.cells, 4, 4)).toBe('wrong');
    act(() => {
      result.current.beginStroke(2, 2);
      result.current.strokeEnter(1, 2);
      result.current.strokeEnter(0, 2);
      result.current.strokeEnter(0, 0);
      result.current.strokeEnter(4, 4);
      result.current.strokeEnter(2, 4);
    });
    expect(at(result.current.cells, 2, 2)).toBe('mark');
    expect(at(result.current.cells, 1, 2)).toBe('mark');
    expect(at(result.current.cells, 0, 2)).toBe('auto');
    expect(at(result.current.cells, 0, 0)).toBe('hamster');
    expect(at(result.current.cells, 4, 4)).toBe('wrong');
    expect(at(result.current.cells, 2, 4)).toBe('mark');
  });

  it('되돌아가면 그 칸이 다시 토글된다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.beginStroke(0, 0);
      result.current.strokeEnter(0, 1);
      result.current.strokeEnter(0, 2);
      result.current.strokeEnter(0, 1);
    });
    expect(at(result.current.cells, 0, 0)).toBe('mark');
    expect(at(result.current.cells, 0, 1)).toBe('empty');
    expect(at(result.current.cells, 0, 2)).toBe('mark');
  });

  it('같은 칸 연발 진입은 한 번만 토글한다', () => {
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

  it('움직임 없이 끝나면 탭으로 취급하고 칸은 손대지 않는다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    let engaged = true;
    act(() => {
      result.current.beginStroke(0, 0);
      result.current.strokeEnter(0, 0);
      engaged = result.current.endStroke();
    });
    expect(engaged).toBe(false);
    expect(at(result.current.cells, 0, 0)).toBe('empty');
  });

  it('햄스터 칸에서 시작해도 이후 지나간 빈칸은 칠해진다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.tapCell(0, 0, 'double');
    });
    let engaged = false;
    act(() => {
      result.current.beginStroke(0, 0);
      result.current.strokeEnter(1, 1);
      result.current.strokeEnter(2, 2);
      engaged = result.current.endStroke();
    });
    expect(engaged).toBe(true);
    expect(at(result.current.cells, 0, 0)).toBe('hamster');
    expect(at(result.current.cells, 1, 1)).toBe('auto');
    expect(at(result.current.cells, 2, 2)).toBe('mark');
  });
});
