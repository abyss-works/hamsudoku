import type { CellState } from './puzzles';

export interface Violations {
  rows: Set<number>;
  cols: Set<number>;
  islands: Set<number>;
}

export function getViolations(cells: CellState[][], islands: number[][]): Violations {
  const rows = new Set<number>();
  const cols = new Set<number>();
  const islandIds = new Set<number>();
  for (const row of islands) for (const id of row) islandIds.add(id);

  const rowCount = new Map<number, number>();
  const colCount = new Map<number, number>();
  const islandCount = new Map<number, number>();
  for (const id of islandIds) islandCount.set(id, 0);

  cells.forEach((line, r) => {
    line.forEach((cell, c) => {
      if (cell !== 'hamster') return;
      rowCount.set(r, (rowCount.get(r) ?? 0) + 1);
      colCount.set(c, (colCount.get(c) ?? 0) + 1);
      const id = islands[r][c];
      islandCount.set(id, (islandCount.get(id) ?? 0) + 1);
    });
  });

  for (const [r, n] of rowCount) if (n >= 2) rows.add(r);
  for (const [c, n] of colCount) if (n >= 2) cols.add(c);
  const unfilled = new Set<number>();
  for (const [id, n] of islandCount) if (n !== 1) unfilled.add(id);

  return { rows, cols, islands: unfilled };
}

export function isCleared(cells: CellState[][], islands: number[][]): boolean {
  let total = 0;
  for (const line of cells) for (const cell of line) if (cell === 'hamster') total += 1;
  if (total !== 5) return false;
  const v = getViolations(cells, islands);
  return v.rows.size === 0 && v.cols.size === 0 && v.islands.size === 0;
}
