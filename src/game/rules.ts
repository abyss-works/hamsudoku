import type { CellState, Puzzle } from './puzzles';

export type { CellState };

export interface Violations {
  rows: Set<number>;
  cols: Set<number>;
  islands: Set<number>;
  touch: Set<string>;
}

export function keyOf(r: number, c: number): string {
  return `${r},${c}`;
}

function touches(a: [number, number], b: [number, number]): boolean {
  return Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1;
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
  const overfilled = new Set<number>();
  for (const [id, n] of islandCount) if (n >= 2) overfilled.add(id);

  const spots: [number, number][] = [];
  cells.forEach((line, r) => {
    line.forEach((cell, c) => {
      if (cell === 'hamster') spots.push([r, c]);
    });
  });
  const touch = new Set<string>();
  for (let i = 0; i < spots.length; i += 1) {
    for (let j = i + 1; j < spots.length; j += 1) {
      if (touches(spots[i], spots[j])) {
        touch.add(keyOf(spots[i][0], spots[i][1]));
        touch.add(keyOf(spots[j][0], spots[j][1]));
      }
    }
  }

  return { rows, cols, islands: overfilled, touch };
}

export function isSolutionCell(puzzle: Puzzle, r: number, c: number): boolean {
  return puzzle.solution.some(([sr, sc]) => sr === r && sc === c);
}

export function isCleared(cells: CellState[][], islands: number[][]): boolean {
  let total = 0;
  for (const line of cells) for (const cell of line) if (cell === 'hamster') total += 1;
  // 섬 N개에 햄스터 N마리, 위반 없음 → 각 섬 정확히 1마리, 행·열 중복 없음, 인접 없음
  if (total !== islands.length) return false;
  const v = getViolations(cells, islands);
  return v.rows.size === 0 && v.cols.size === 0 && v.islands.size === 0 && v.touch.size === 0;
}
