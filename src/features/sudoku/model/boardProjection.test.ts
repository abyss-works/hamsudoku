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

  it('projectBoard가 반응을 받은 햄스터 칸에만 표정과 하트 수를 싣는다', () => {
    const puzzle: Puzzle = { name: '연습 퍼즐', size: 2, islands: [[0, 1], [1, 0]], solution: [[0, 1], [1, 0]] };
    const cells = [
      ['empty', 'hamster'],
      ['hamster', 'wrong'],
    ] as any;
    const violations = { rows: new Set(), cols: new Set(), islands: new Set(), touch: new Set() } as any;
    const correct = projectBoard(cells, puzzle, new Set(), violations, new Map(), '0,1', new Set(),
      { kind: 'correct', tier: 2, key: '0,1', seq: 3 });
    expect(correct[0][1].reaction).toEqual({ expression: 'smile', hearts: 2, seq: 3 });
    expect(correct[1][0].reaction).toBeNull();
    expect(correct[0][0].reaction).toBeNull();
    const plain = projectBoard(cells, puzzle, new Set(), violations, new Map(), null);
    expect(plain[0][1].reaction).toBeNull();
  });
});
