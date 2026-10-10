import { describe, expect, it } from 'vitest';
import { cellsAlongSegment } from './path';

// 좌표는 (x = 열, y = 행) 연속 격자 좌표다. 칸 (r, c)의 중심은 (c + 0.5, r + 0.5).
describe('cellsAlongSegment', () => {
  it('같은 칸 안의 이동은 그 칸 하나다', () => {
    expect(cellsAlongSegment([0.2, 0.2], [0.8, 0.7], 5)).toEqual([[0, 0]]);
  });

  it('가로로 세 칸을 지나면 세 칸이 순서대로 나온다', () => {
    expect(cellsAlongSegment([0.5, 1.5], [2.5, 1.5], 5)).toEqual([
      [1, 0],
      [1, 1],
      [1, 2],
    ]);
  });

  it('세로로 거꾸로 지나면 위쪽으로 순서대로 나온다', () => {
    expect(cellsAlongSegment([0.5, 2.5], [0.5, 0.5], 5)).toEqual([
      [2, 0],
      [1, 0],
      [0, 0],
    ]);
  });

  it('대각선은 가로·세로 한 칸씩만 옮겨 이어진 칸 열이 된다', () => {
    const cells = cellsAlongSegment([0.5, 0.5], [2.5, 2.5], 5);
    expect(cells[0]).toEqual([0, 0]);
    expect(cells[cells.length - 1]).toEqual([2, 2]);
    expect(cells).toHaveLength(5);
    for (let i = 1; i < cells.length; i += 1) {
      const d = Math.abs(cells[i][0] - cells[i - 1][0]) + Math.abs(cells[i][1] - cells[i - 1][1]);
      expect(d).toBe(1);
    }
  });

  it('완만한 사선은 지나는 칸을 빠짐없이 낸다', () => {
    const cells = cellsAlongSegment([0.1, 0.5], [4.9, 1.5], 5);
    expect(cells[0]).toEqual([0, 0]);
    expect(cells[cells.length - 1]).toEqual([1, 4]);
    const keys = new Set(cells.map(([r, c]) => `${r},${c}`));
    expect(keys.size).toBe(cells.length);
    expect(cells).toHaveLength(6);
  });

  it('보드 밖 좌표는 가장자리 칸으로 잘린다', () => {
    expect(cellsAlongSegment([-0.5, 0.5], [1.5, 0.5], 5)).toEqual([
      [0, 0],
      [0, 1],
    ]);
    expect(cellsAlongSegment([4.5, 4.5], [7, 4.5], 5)).toEqual([[4, 4]]);
  });
});
