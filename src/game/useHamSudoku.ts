import { useState } from 'react';
import { getViolations, isCleared, isSolutionCell, type Violations } from './rules';
import type { CellState, Puzzle } from './puzzles';
import { nextState, type TapKind } from './tap';

function blankBoard(size: number): CellState[][] {
  return Array.from({ length: size }, () => Array<CellState>(size).fill('empty'));
}

function autoMark(board: CellState[][], r: number, c: number): void {
  const size = board.length;
  for (let i = 0; i < size; i += 1) {
    if (board[r][i] === 'empty') board[r][i] = 'mark';
    if (board[i][c] === 'empty') board[i][c] = 'mark';
  }
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nc >= 0 && nr < size && nc < size && board[nr][nc] === 'empty') {
        board[nr][nc] = 'mark';
      }
    }
  }
}

export interface HamSudoku {
  cells: CellState[][];
  violations: Violations;
  cleared: boolean;
  hamsterCount: number;
  tapCell: (r: number, c: number, kind: TapKind) => void;
  reset: () => void;
}

export function useHamSudoku(puzzle: Puzzle): HamSudoku {
  const [cells, setCells] = useState<CellState[][]>(() => blankBoard(puzzle.size));

  const violations = getViolations(cells, puzzle.islands);
  const cleared = isCleared(cells, puzzle.islands);
  let hamsterCount = 0;
  for (const line of cells) for (const cell of line) if (cell === 'hamster') hamsterCount += 1;

  const tapCell = (r: number, c: number, kind: TapKind) => {
    setCells((prev) => {
      const next = prev.map((line) => [...line]);
      const result = nextState(prev[r][c], kind, isSolutionCell(puzzle, r, c));
      next[r][c] = result;
      if (result === 'hamster') autoMark(next, r, c);
      return next;
    });
  };

  const reset = () => setCells(blankBoard(puzzle.size));

  return { cells, violations, cleared, hamsterCount, tapCell, reset };
}
