import { describe, expect, it } from 'vitest';
import { clearDialogModel, probeButtonModel, projectBoard } from './boardProjection';
import type { Puzzle } from './puzzles';

describe('sudoku pure models in boardProjection', () => {
  it('clearDialogModel이 햄스터 수 문구와 파티 아이템을 생성한다', () => {
    expect(clearDialogModel(4)).toEqual({
      title: '햄스터 4마리를 다 찾았다!',
      partyIndices: [0, 1, 2, 3, 4],
    });
  });

  it('probeButtonModel이 토글 aria-label과 슬롯 표시 문구를 생성한다', () => {
    expect(probeButtonModel(false, 3)).toEqual({
      active: false,
      toggleLabel: '임시 정답 켜기',
      slotText: '3/3',
    });
    expect(probeButtonModel(true, 1)).toEqual({
      active: true,
      toggleLabel: '임시 정답 끄기',
      slotText: '1/3',
    });
  });

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
