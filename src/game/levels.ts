import type { Puzzle } from './puzzles';

export interface GeneratedLevel {
  level: number;
  no: number;
  code: string;
  puzzle: Puzzle;
}

export interface LevelConfig {
  size: number;
  count: number;
  minStraight: number;
  maxStraight: number;
}

export const LEVEL_CONFIGS: Record<number, LevelConfig> = {
  1: { size: 5, count: 10, minStraight: 0.6, maxStraight: 1 },
  2: { size: 6, count: 10, minStraight: 0.3, maxStraight: 0.6 },
  3: { size: 7, count: 10, minStraight: 0, maxStraight: 1 },
};
