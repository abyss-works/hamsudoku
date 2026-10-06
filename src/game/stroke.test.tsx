// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useHamSudoku } from './useHamSudoku';
import { PUZZLES } from './puzzles';

afterEach(cleanup);

const at = (cells: string[][], r: number, c: number) => cells[r][c];

describe('stroke', () => {
  it('빈칸에서 시작하면 지나간 빈칸만 마크가 되고 마크는 그대로다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.tapCell(0, 1, 'single');
    });
    act(() => {
      result.current.beginStroke(0, 0);
      result.current.strokeEnter(0, 1);
      result.current.strokeEnter(0, 2);
      result.current.strokeEnter(0, 3);
    });
    expect(result.current.cells[0]).toEqual(['mark', 'mark', 'mark', 'mark', 'empty']);
  });

  it('마크에서 시작하면 지나간 마크만 빈칸이 되고 빈칸은 그대로다 (1101 → 0000)', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.tapCell(0, 0, 'single');
      result.current.tapCell(0, 1, 'single');
      result.current.tapCell(0, 3, 'single');
    });
    expect(result.current.cells[0]).toEqual(['mark', 'mark', 'empty', 'mark', 'empty']);
    act(() => {
      result.current.beginStroke(0, 0);
      result.current.strokeEnter(0, 1);
      result.current.strokeEnter(0, 2);
      result.current.strokeEnter(0, 3);
    });
    expect(result.current.cells[0]).toEqual(['empty', 'empty', 'empty', 'empty', 'empty']);
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

  it('되돌아가도 이미 지나간 칸은 다시 바뀌지 않는다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.beginStroke(0, 0);
      result.current.strokeEnter(0, 1);
      result.current.strokeEnter(0, 2);
      result.current.strokeEnter(0, 3);
      result.current.strokeEnter(0, 2);
      result.current.strokeEnter(0, 1);
      result.current.strokeEnter(0, 0);
    });
    expect(result.current.cells[0]).toEqual(['mark', 'mark', 'mark', 'mark', 'empty']);
  });

  it('지나간 칸으로 돌아왔다 다시 나가도 스트로크는 살아 있다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.beginStroke(0, 0);
      result.current.strokeEnter(0, 1);
      result.current.strokeEnter(0, 0);
      result.current.strokeEnter(1, 0);
    });
    expect(at(result.current.cells, 0, 0)).toBe('mark');
    expect(at(result.current.cells, 0, 1)).toBe('mark');
    expect(at(result.current.cells, 1, 0)).toBe('mark');
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

describe('clearMarks', () => {
  it('마크만 전부 빈칸으로 되돌리고 햄스터·자동·오답은 그대로 둔다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.tapCell(0, 0, 'double'); // 햄스터, (0,2) 자동
      result.current.tapCell(4, 4, 'double'); // 오답
      result.current.tapCell(2, 2, 'single');
      result.current.tapCell(3, 1, 'single');
    });
    expect(at(result.current.cells, 2, 2)).toBe('mark');
    act(() => {
      result.current.clearMarks();
    });
    expect(at(result.current.cells, 2, 2)).toBe('empty');
    expect(at(result.current.cells, 3, 1)).toBe('empty');
    expect(at(result.current.cells, 0, 0)).toBe('hamster');
    expect(at(result.current.cells, 0, 2)).toBe('auto');
    expect(at(result.current.cells, 4, 4)).toBe('wrong');
  });
});
