import { resolveMark } from './probe';
import { cellConflicted, type Violations } from './rules';
import type { CellState, Puzzle } from './puzzles';

export function projectBoard(cells: CellState[][], puzzle: Puzzle, xMarks: ReadonlySet<string>, violations: Violations,
  pulse: ReadonlyMap<string, number>, hitKey: string | null) {
  return cells.map((line, row) => line.map((state, col) => {
    const key = `${row},${col}`;
    return { row, col, state: resolveMark(state, xMarks.has(key)), islandId: puzzle.islands[row][col],
      conflicted: cellConflicted(violations, puzzle.islands, row, col), hit: hitKey === key, pulseDelay: pulse.get(key) };
  }));
}
