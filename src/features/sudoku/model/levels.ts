import type { Measure } from '../../../shared/sudoku/logic';
import type { Puzzle } from './puzzles';
import type { BandConfig, Range } from '../../../shared/sudoku/difficulty';

export interface GeneratedLevel {
  level: number;
  no: number;
  code: string;
  puzzle: Puzzle;
  measure: Measure;
}

export interface LevelConfig extends BandConfig {
  count: number;
  poolFactor?: number; // 후보 풀 크기는 count에 poolFactor를 곱한다. 생략하면 4를 사용한다.
}

const NONE: Range = { min: 0, max: 0 };

// 수치는 생성기 --report (크기별 300개, 시드 7) 분포의 분위에서 정한 초기값이다. 바뀌면 WEIGHTS.version 과 함께 기록한다.
export const LEVEL_CONFIGS: Record<number, LevelConfig> = {
  1: { size: 5, count: 10, maxTier: 0, t1: NONE, t2: NONE, t3: NONE, maxChain: 0, singles: { min: 1, max: 2 }, score: NONE },
  2: { size: 6, count: 10, maxTier: 1, t1: { min: 1, max: 3 }, t2: NONE, t3: NONE, maxChain: 0, singles: { min: 0, max: 1 }, score: { min: 3, max: 9 } },
  3: { size: 6, count: 10, maxTier: 2, t1: { min: 1, max: 4 }, t2: { min: 1, max: 1 }, t3: NONE, maxChain: 0, singles: { min: 0, max: 1 }, score: { min: 10, max: 18 } },
  4: { size: 7, count: 10, maxTier: 2, t1: { min: 1, max: 5 }, t2: { min: 1, max: 3 }, t3: NONE, maxChain: 0, singles: { min: 0, max: 1 }, score: { min: 15, max: 30 } },
  5: { size: 7, count: 10, maxTier: 3, t1: { min: 1, max: 6 }, t2: { min: 0, max: 4 }, t3: { min: 0, max: 2 }, maxChain: 4, singles: { min: 0, max: 1 }, score: { min: 31, max: 90 } },
};

export function poolTarget(cfg: LevelConfig): number {
  return cfg.count * (cfg.poolFactor ?? 4);
}
