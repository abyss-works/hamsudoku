import type { Pos } from './solver';

export interface IslandStats {
  id: number;
  size: number;
  rowSpan: number;
  colSpan: number;
  straight: boolean;
  bends: number;
}

export interface DifficultyScore {
  straightRatio: number;
  maxSize: number;
  bends: number;
}

function cellsOf(islands: number[][], id: number): Pos[] {
  const out: Pos[] = [];
  islands.forEach((line, r) => {
    line.forEach((cell, c) => {
      if (cell === id) out.push([r, c]);
    });
  });
  return out;
}

function countBends(cells: Pos[]): number {
  let bends = 0;
  let prev: [number, number] | null = null;
  for (let i = 1; i < cells.length; i += 1) {
    const dir: [number, number] = [
      Math.sign(cells[i][0] - cells[i - 1][0]),
      Math.sign(cells[i][1] - cells[i - 1][1]),
    ];
    if (prev && (dir[0] !== prev[0] || dir[1] !== prev[1])) bends += 1;
    prev = dir;
  }
  return bends;
}

export function analyzeIslands(islands: number[][]): IslandStats[] {
  const ids = [...new Set(islands.flat())].sort((a, b) => a - b);
  return ids.map((id) => {
    const cells = cellsOf(islands, id);
    const rows = cells.map(([r]) => r);
    const cols = cells.map(([, c]) => c);
    const rowSpan = Math.max(...rows) - Math.min(...rows) + 1;
    const colSpan = Math.max(...cols) - Math.min(...cols) + 1;
    return {
      id,
      size: cells.length,
      rowSpan,
      colSpan,
      straight: rowSpan === 1 || colSpan === 1,
      bends: countBends(cells),
    };
  });
}

export function scoreDifficulty(islands: number[][]): DifficultyScore {
  const stats = analyzeIslands(islands);
  const straight = stats.filter((s) => s.straight).length;
  return {
    straightRatio: stats.length === 0 ? 0 : straight / stats.length,
    maxSize: Math.max(...stats.map((s) => s.size)),
    bends: stats.reduce((sum, s) => sum + s.bends, 0),
  };
}
