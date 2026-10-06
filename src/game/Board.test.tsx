// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Board } from './Board';
import type { CellState } from './puzzles';
import type { Violations } from './rules';

const emptyViolations = (): Violations => ({ rows: new Set(), cols: new Set(), islands: new Set(), touch: new Set() });

describe('Board', () => {
  it('보드 크기에 맞춰 열 개수를 정한다', () => {
    const cells: CellState[][] = Array.from({ length: 6 }, () => Array<CellState>(6).fill('empty'));
    const islands = Array.from({ length: 6 }, (_, r) => Array(6).fill(r));
    const { container } = render(
      <Board
        puzzle={{ name: '6x6', size: 6, islands, solution: [] }}
        cells={cells}
        violations={emptyViolations()}
        cleared={false}
        onCell={() => {}}
        onPress={() => {}}
        onEnter={() => {}}
        onRelease={() => false}
        onReset={() => {}}
        onNextMap={() => {}}
        onBrowse={() => {}}
      />,
    );
    expect(screen.getAllByRole('button', { name: /빈칸/ })).toHaveLength(36);
    expect(container.querySelector('.board')?.getAttribute('style')).toContain('repeat(6, 1fr)');
  });
});

describe('Board 드래그 경로 보간', () => {
  const setup = () => {
    const size = 5;
    const cells: CellState[][] = Array.from({ length: size }, () => Array<CellState>(size).fill('empty'));
    const islands = Array.from({ length: size }, (_, r) => Array(size).fill(r));
    const entered: [number, number][] = [];
    const { container } = render(
      <Board
        puzzle={{ name: '5x5', size, islands, solution: [] }}
        cells={cells}
        violations={emptyViolations()}
        cleared={false}
        onCell={() => {}}
        onPress={() => {}}
        onEnter={(r, c) => entered.push([r, c])}
        onRelease={() => true}
        onReset={() => {}}
        onNextMap={() => {}}
        onBrowse={() => {}}
      />,
    );
    const board = container.querySelector('.board') as HTMLElement;
    // 보드를 (0,0)~(500,500) 에 두어 칸 하나가 100px 이 되게 한다
    board.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    const cellEls = Array.from(container.querySelectorAll('.cell')) as HTMLElement[];
    return { board, cellEls, entered };
  };

  it('이벤트 사이에 건너뛴 칸도 경로를 따라 전부 들어간다', () => {
    const { board, cellEls, entered } = setup();
    fireEvent.pointerDown(cellEls[0]);
    fireEvent.pointerMove(board, { clientX: 450, clientY: 50, buttons: 1 });
    expect(entered).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ]);
  });

  it('보드 밖으로 나갔다 들어오면 밖에서의 경로는 잇지 않는다', () => {
    const { board, cellEls, entered } = setup();
    fireEvent.pointerDown(cellEls[0]);
    fireEvent.pointerMove(board, { clientX: 50, clientY: 650, buttons: 1 }); // 보드 아래 바깥
    fireEvent.pointerMove(board, { clientX: 450, clientY: 450, buttons: 1 }); // 오른쪽 아래 칸으로 복귀
    expect(entered).toEqual([[4, 4]]);
  });
});
