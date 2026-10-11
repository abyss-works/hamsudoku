import { describe, expect, it } from 'vitest';
import { projectBoard } from './boardProjection';
import type { Puzzle } from './puzzles';

describe('sudoku pure models in boardProjection', () => {

  it('projectBoard가 각 칸의 ariaLabel을 계산하여 view에서 문자열 합성을 제거한다', () => {
    const puzzle: Puzzle = {
      name: '연습 퍼즐',
      size: 2,
      islands: [
        [0, 1],
        [1, 0],
      ],
      solution: [
        [0, 1],
        [1, 0],
      ],
    };
    const cells = [
      ['empty', 'mark'],
      ['hamster', 'wrong'],
    ] as any;
    const projected = projectBoard(
      cells,
      puzzle,
      new Set(),
      { rows: new Set(), cols: new Set(), islands: new Set(), touch: new Set() },
      new Map(),
      null,
    );
    expect(projected[0][0].ariaLabel).toBe('빈칸 (색 1)');
    expect(projected[0][1].ariaLabel).toBe('X 표시 (색 2)');
    expect(projected[1][0].ariaLabel).toBe('햄스터 (색 2)');
    expect(projected[1][1].ariaLabel).toBe('틀린 칸 (색 1)');
  });
});
