import { describe, expect, it } from 'vitest';
import { PUZZLES } from './puzzles';
import { getViolations, isCleared, type CellState } from './rules';

const blank = (): CellState[][] => Array.from({ length: 5 }, () => Array(5).fill('empty'));

describe('getViolations', () => {
  it('빈판은 위반 없음', () => {
    const v = getViolations(blank(), PUZZLES[0].islands);
    expect(v.rows.size).toBe(0);
    expect(v.cols.size).toBe(0);
    expect(v.islands.size).toBe(5);
  });
  it('같은 행 2마리는 해당 행 위반', () => {
    const c = blank(); c[0][0] = 'hamster'; c[0][2] = 'hamster';
    expect(getViolations(c, PUZZLES[0].islands).rows.has(0)).toBe(true);
  });
  it('같은 열 2마리는 해당 열 위반', () => {
    const c = blank(); c[0][0] = 'hamster'; c[3][0] = 'hamster';
    expect(getViolations(c, PUZZLES[0].islands).cols.has(0)).toBe(true);
  });
  it('한 섬 2마리는 해당 섬 위반, 씨앗은 무시', () => {
    const c = blank(); c[0][0] = 'hamster'; c[0][1] = 'hamster'; c[4][4] = 'seed';
    const v = getViolations(c, PUZZLES[0].islands);
    expect(v.islands.has(0)).toBe(true);
    // 씨앗은 햄스터로 세지 않으므로 섬 4는 여전히 0마리 → 위반 집합에 남음
    expect(v.islands.has(4)).toBe(true);
  });
});

describe('isCleared', () => {
  it('solution 배치는 클리어', () => {
    const c = blank();
    for (const [r, col] of PUZZLES[0].solution) c[r][col] = 'hamster';
    expect(isCleared(c, PUZZLES[0].islands)).toBe(true);
  });
  it('6마리 배치는 클리어 아님', () => {
    const c = blank();
    for (const [r, col] of PUZZLES[0].solution) c[r][col] = 'hamster';
    c[4][0] = 'hamster';
    expect(isCleared(c, PUZZLES[0].islands)).toBe(false);
  });
});
