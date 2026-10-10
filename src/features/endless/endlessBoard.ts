import type { Puzzle } from '../sudoku/model/puzzles';

export function parseRegions(text: string, size: number): number[][] {
  const cells = text.split('').map(Number);
  return Array.from({ length: size }, (_, r) => cells.slice(r * size, (r + 1) * size));
}

export function toPuzzle(stage: { size: number; regions: string }, solution: [number, number][]): Puzzle {
  return { name: '', size: stage.size, islands: parseRegions(stage.regions, stage.size), solution };
}
