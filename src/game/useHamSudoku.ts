import { useState } from 'react';
import { getViolations, isCleared, type Violations } from './rules';
import type { CellState, Puzzle } from './puzzles';

const NEXT: Record<CellState, CellState> = {
  empty: 'hamster',
  hamster: 'seed',
  seed: 'empty',
};

function blankBoard(size: number): CellState[][] {
  return Array.from({ length: size }, () => Array<CellState>(size).fill('empty'));
}

export interface HamSudoku {
  cells: CellState[][];
  violations: Violations;
  cleared: boolean;
  hamsterCount: number;
  cycleCell: (r: number, c: number) => void;
  reset: () => void;
}

export function useHamSudoku(puzzle: Puzzle): HamSudoku {
  const [cells, setCells] = useState<CellState[][]>(() => blankBoard(puzzle.size));

  const violations = getViolations(cells, puzzle.islands);
  const cleared = isCleared(cells, puzzle.islands);
  let hamsterCount = 0;
  for (const line of cells) for (const cell of line) if (cell === 'hamster') hamsterCount += 1;

  const cycleCell = (r: number, c: number) => {
    setCells((prev) => {
      const next = prev.map((line) => [...line]);
      next[r][c] = NEXT[prev[r][c]];
      return next;
    });
  };

  const reset = () => setCells(blankBoard(puzzle.size));

  return { cells, violations, cleared, hamsterCount, cycleCell, reset };
}
