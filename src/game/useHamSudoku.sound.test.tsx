// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { Howl, Howler } from 'howler';
import { cascadeFrequencies, resetSoundForTests } from './sound';
import { useHamSudoku } from './useHamSudoku';
import { PUZZLES } from './puzzles';

vi.mock('howler', () => ({
  Howl: vi.fn(function (this: { play?: unknown; rate?: unknown; volume?: unknown }) {
    this.play = vi.fn(() => 7); this.rate = vi.fn(); this.volume = vi.fn();
  }), Howler: { ctx: null as unknown },
}));
const notes: number[][] = [];
beforeEach(() => {
  vi.useFakeTimers();
  notes.length = 0;
  (Howler as unknown as { ctx: unknown }).ctx = {
    state: 'running', destination: {},
    get currentTime() { notes.push([]); return 10; },
    createOscillator() {
      return { type: '', frequency: { value: 0 }, connect() {},
        start(this: { frequency: { value: number } }) { notes[notes.length - 1].push(this.frequency.value); }, stop() {} };
    },
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; },
  };
});
afterEach(() => { cleanup(); resetSoundForTests(); vi.useRealTimers(); });
const at = (cells: string[][], r: number, c: number) => cells[r][c];
const badRates = () => {
  vi.runAllTimers();
  const index = vi.mocked(Howl).mock.calls.findIndex(([options]) => options.src?.[0] === '/sfx/bad.wav');
  const howl = vi.mocked(Howl).mock.instances[index];
  return vi.mocked(howl.rate).mock.calls.map(([rate], i) => [rate, vi.mocked(howl.volume).mock.calls[i][0]]);
};
const progCalls = () => notes;

describe('streak sounds', () => {
  it('맞힐 때마다 높아지고 한음씩 붙는다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.tapCell(0, 0, 'double');
    });
    expect(at(result.current.cells, 0, 0)).toBe('hamster');
    act(() => {
      result.current.tapCell(1, 3, 'double');
    });
    expect(at(result.current.cells, 1, 3)).toBe('hamster');
    expect(progCalls()).toEqual([cascadeFrequencies(2), cascadeFrequencies(4).slice(1)]);
  });

  it('오답은 실패할 때마다 두음씩 오른다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.tapCell(0, 3, 'double');
    });
    expect(at(result.current.cells, 0, 3)).toBe('wrong');
    act(() => {
      result.current.tapCell(4, 4, 'double');
    });
    expect(at(result.current.cells, 4, 4)).toBe('wrong');
    const [r1, r2] = badRates();
    expect(r1[0]).toBeCloseTo(2 ** (2 / 12), 5);
    expect(r2[0]).toBeCloseTo(2 ** (4 / 12), 5);
    expect(r1[1]).toBe(0.7);
    expect(r2[1]).toBe(0.7);
  });

  it('맞히면 오답 횟수가 돌아간다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.tapCell(0, 3, 'double');
    });
    act(() => {
      result.current.tapCell(0, 0, 'double');
    });
    act(() => {
      result.current.tapCell(4, 4, 'double');
    });
    expect(at(result.current.cells, 4, 4)).toBe('wrong');
    const [w1, w2] = badRates();
    expect(w1[0]).toBeCloseTo(2 ** (2 / 12), 5);
    expect(w2[0]).toBeCloseTo(2 ** (2 / 12), 5);
    expect(progCalls()).toEqual([cascadeFrequencies(2)]);
  });
});

describe('global double', () => {
  it('아이템이 켜져 있어도 빈칸 더블은 확정한다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.setProbeActive(true);
      result.current.tapCell(0, 0, 'double');
    });
    expect(at(result.current.cells, 0, 0)).toBe('hamster');
    expect(result.current.probeSlots).toBe(3);
    expect(progCalls()).toEqual([cascadeFrequencies(2)]);
  });

  it('아이템이 켜져 있어도 앵커 더블은 지우고 확정한다', () => {
    const { result } = renderHook(() => useHamSudoku(PUZZLES[0]));
    act(() => {
      result.current.setProbeActive(true);
      result.current.tapCell(0, 0, 'single');
    });
    expect(at(result.current.cells, 0, 0)).toBe('anchor');
    act(() => {
      result.current.tapCell(0, 0, 'double');
    });
    expect(at(result.current.cells, 0, 0)).toBe('hamster');
    expect(at(result.current.cells, 0, 1)).toBe('auto');
    expect(result.current.probeSlots).toBe(3);
  });
});
