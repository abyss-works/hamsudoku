import { describe, expect, it } from 'vitest';
import { PUZZLES } from './puzzles';
import { getViolations, isCleared, type CellState } from './rules';

const blank = (): CellState[][] => Array.from({ length: 5 }, () => Array(5).fill('empty'));

describe('getViolations', () => {
  it('빈판은 충돌 없음', () => {
    const v = getViolations(blank(), PUZZLES[0].islands);
    expect(v.rows.size).toBe(0);
    expect(v.cols.size).toBe(0);
    expect(v.islands.size).toBe(0);
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
    const c = blank(); c[2][3] = 'hamster'; c[3][3] = 'hamster'; c[0][0] = 'seed';
    const v = getViolations(c, PUZZLES[0].islands);
    expect(v.islands.has(3)).toBe(true);
    // 빈 섬은 충돌이 아니므로 씨앗만 있는 섬 0은 집합에 없음
    expect(v.islands.has(0)).toBe(false);
  });
  it('인접한 2마리는 두 셀 모두 인접 위반', () => {
    const c = blank(); c[1][2] = 'hamster'; c[2][3] = 'hamster';
    const v = getViolations(c, PUZZLES[0].islands);
    expect(v.touch.has('1,2')).toBe(true);
    expect(v.touch.has('2,3')).toBe(true);
  });
  it('대각선도 인접이다', () => {
    const c = blank(); c[0][0] = 'hamster'; c[1][1] = 'hamster';
    expect(getViolations(c, PUZZLES[0].islands).touch.size).toBe(2);
  });
  it('두 칸 이상 떨어지면 인접 위반 없음', () => {
    const c = blank(); c[0][0] = 'hamster'; c[2][4] = 'hamster';
    const v = getViolations(c, PUZZLES[0].islands);
    expect(v.touch.size).toBe(0);
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
  it('5마리라도 행 중복이면 클리어 아님', () => {
    const c = blank();
    c[0][0] = 'hamster'; c[0][2] = 'hamster'; c[2][3] = 'hamster'; c[3][1] = 'hamster'; c[4][4] = 'hamster';
    expect(isCleared(c, PUZZLES[0].islands)).toBe(false);
  });
  it('인접 배치는 클리어 아님', () => {
    const c = blank();
    c[0][3] = 'hamster'; c[1][4] = 'hamster'; c[2][0] = 'hamster'; c[3][1] = 'hamster'; c[4][2] = 'hamster';
    expect(isCleared(c, PUZZLES[0].islands)).toBe(false);
  });
});
