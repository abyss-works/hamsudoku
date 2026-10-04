// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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
        onReset={() => {}}
        onNextMap={() => {}}
      />,
    );
    expect(screen.getAllByRole('button', { name: /빈칸/ })).toHaveLength(36);
    expect(container.querySelector('.board')?.getAttribute('style')).toContain('repeat(6, 1fr)');
  });
});
