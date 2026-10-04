export type CellState = 'empty' | 'mark' | 'hamster' | 'wrong';

export interface Puzzle {
  name: string;
  size: number;
  islands: number[][];
  solution: [number, number][];
}

export const PUZZLES: Puzzle[] = [
  {
    name: '햄스터 마을 입구',
    size: 5,
    islands: [
      [0, 1, 1, 1, 1],
      [2, 2, 1, 1, 1],
      [2, 2, 2, 3, 3],
      [4, 2, 3, 3, 3],
      [4, 4, 4, 3, 3],
    ],
    solution: [
      [0, 0],
      [1, 3],
      [2, 1],
      [3, 4],
      [4, 2],
    ],
  },
  {
    name: '해바라기 밭',
    size: 5,
    islands: [
      [0, 0, 0, 3, 3],
      [2, 0, 3, 3, 1],
      [2, 3, 3, 3, 1],
      [2, 4, 3, 3, 1],
      [2, 2, 2, 3, 3],
    ],
    solution: [
      [0, 2],
      [1, 0],
      [2, 4],
      [3, 1],
      [4, 3],
    ],
  },
];
