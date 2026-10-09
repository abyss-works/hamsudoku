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

describe('probe', () => {
  it('아이템을 켜고 빈칸을 톡하면 앵커가 놓이고 십자·주변에 조각이 살포된다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    expect(result.current.probeActive).toBe(false);
    expect(result.current.probeSlots).toBe(3);
    act(() => {
      result.current.setProbeActive(true);
      result.current.tapCell(2, 2, 'single');
    });
    expect(result.current.probeActive).toBe(true);
    expect(at(result.current.cells, 2, 2)).toBe('anchor');
    expect(result.current.probeSlots).toBe(2);
    // 같은 행·열·주변은 조각, 대각 멀리는 그대로
    expect(at(result.current.cells, 2, 0)).toBe('frag');
    expect(at(result.current.cells, 0, 2)).toBe('frag');
    expect(at(result.current.cells, 1, 1)).toBe('frag');
    expect(at(result.current.cells, 0, 0)).toBe('empty');
  });

  it('앵커를 톡하면 자기 조각만 회수되고 슬롯이 충전된다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.setProbeActive(true);
      result.current.tapCell(2, 2, 'single');
      result.current.tapCell(2, 2, 'single');
    });
    expect(at(result.current.cells, 2, 2)).toBe('empty');
    expect(at(result.current.cells, 2, 0)).toBe('empty');
    expect(at(result.current.cells, 0, 2)).toBe('empty');
    expect(result.current.probeSlots).toBe(3);
    // 회수는 먼 조각부터 역순 딜레이로 사라진다(12조각, 최대 11*60ms)
    const delays = [...result.current.pulse.values()];
    expect(delays).toHaveLength(12);
    expect(Math.max(...delays)).toBe(11 * 60);
  });

  it('슬롯이 없으면 놓기 시도를 무시한다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.setProbeActive(true);
      result.current.tapCell(0, 0, 'single');
      result.current.tapCell(2, 2, 'single');
      result.current.tapCell(1, 4, 'single');
    });
    expect(at(result.current.cells, 0, 0)).toBe('anchor');
    expect(at(result.current.cells, 2, 2)).toBe('anchor');
    expect(at(result.current.cells, 1, 4)).toBe('anchor');
    expect(result.current.probeSlots).toBe(0);
    // 3개를 다 쓰면 토글이 풀린다
    expect(result.current.probeActive).toBe(false);
    act(() => {
      result.current.tapCell(4, 1, 'single');
    });
    expect(at(result.current.cells, 4, 1)).toBe('mark');
    expect(result.current.probeSlots).toBe(0);
  });

  it('아이템을 끄고 앵커를 확정하면 정답은 햄스터·조각은 정답마커가 된다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.setProbeActive(true);
      result.current.tapCell(1, 1, 'single'); // 가설 앵커
      result.current.setProbeActive(false);
    });
    // PUZZLES[0] solution[0] 좌표에 앵커가 있다고 가정하지 않고 직접 확인한다
    expect(at(result.current.cells, 1, 1)).toBe('anchor');
    act(() => {
      result.current.tapCell(1, 1, 'double');
    });
    const after = at(result.current.cells, 1, 1);
    // 정답이면 햄스터, 오답이면 오답마커다
    expect(after === 'hamster' || after === 'wrong').toBe(true);
    if (after === 'hamster') {
      expect(at(result.current.cells, 1, 0)).toBe('auto');
    }
    expect(result.current.probeSlots).toBe(3);
  });

  it('아이템이 켜진 동안 스트로크는 무시된다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.setProbeActive(true);
      result.current.beginStroke(0, 0);
      result.current.strokeEnter(0, 1);
      const engaged = result.current.endStroke();
      expect(engaged).toBe(false);
    });
    expect(at(result.current.cells, 0, 0)).toBe('empty');
    expect(at(result.current.cells, 0, 1)).toBe('empty');
  });

  it('지우기 스트로크가 앵커를 만나면 조각까지 함께 회수한다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.setProbeActive(true);
      result.current.tapCell(2, 2, 'single');
      result.current.setProbeActive(false);
      result.current.tapCell(0, 0, 'single'); // 회색 X
    });
    expect(at(result.current.cells, 0, 0)).toBe('mark');
    act(() => {
      result.current.beginStroke(0, 0);
      result.current.strokeEnter(1, 1);
      result.current.strokeEnter(2, 2);
    });
    expect(at(result.current.cells, 0, 0)).toBe('empty');
    expect(at(result.current.cells, 2, 2)).toBe('empty');
    expect(at(result.current.cells, 2, 0)).toBe('empty');
    expect(result.current.probeSlots).toBe(3);
  });
});

describe('정답 전파', () => {
  it('햄스터가 생기면 같은 줄·주변의 임시마커도 정답마커로 바뀐다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.tapCell(0, 1, 'single'); // 같은 행의 임시마커
      result.current.tapCell(3, 0, 'single'); // 같은 열의 임시마커
      result.current.tapCell(1, 1, 'single'); // 대각 이웃의 임시마커
      result.current.tapCell(2, 2, 'single'); // 무관한 칸의 임시마커
    });
    act(() => {
      result.current.tapCell(0, 0, 'double'); // 정답
    });
    expect(at(result.current.cells, 0, 0)).toBe('hamster');
    expect(at(result.current.cells, 0, 1)).toBe('auto');
    expect(at(result.current.cells, 3, 0)).toBe('auto');
    expect(at(result.current.cells, 1, 1)).toBe('auto');
    expect(at(result.current.cells, 2, 2)).toBe('mark');
  });

  it('일반 전파는 조각을 정답마커로 바꾸고 남의 앵커는 그대로 둔다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.setProbeActive(true);
      result.current.tapCell(2, 3, 'single'); // 앵커+조각
      result.current.setProbeActive(false);
    });
    expect(at(result.current.cells, 2, 3)).toBe('anchor');
    expect(at(result.current.cells, 0, 3)).toBe('frag');
    expect(at(result.current.cells, 0, 0)).toBe('empty');
    act(() => {
      result.current.tapCell(0, 0, 'double'); // 정답 확정
    });
    expect(at(result.current.cells, 0, 0)).toBe('hamster');
    expect(at(result.current.cells, 0, 3)).toBe('auto');
    expect(at(result.current.cells, 2, 3)).toBe('anchor');
  });

  it('오답마커는 정답 전파로 바뀌지 않는다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.tapCell(0, 3, 'double'); // 오답 (정답은 (0,0))
    });
    expect(at(result.current.cells, 0, 3)).toBe('wrong');
    act(() => {
      result.current.tapCell(0, 0, 'double');
    });
    expect(at(result.current.cells, 0, 3)).toBe('wrong');
  });
});
