import type { Measure } from './logic';
import type { Puzzle } from './puzzles';
import { analyzeIslands, type DifficultyScore } from './shape';

export interface GeneratedLevel {
  level: number;
  no: number;
  code: string;
  puzzle: Puzzle;
  measure: Measure;
}

export interface Range {
  min: number;
  max: number;
}

export interface LevelConfig {
  size: number;
  count: number;
  maxTier: 0 | 1 | 2 | 3;
  t1: Range;
  t2: Range;
  t3: Range;
  maxChain: number;
  singles: Range;
  score: Range;
  straight?: Range;
  maxIsland?: number;
  poolFactor?: number;           // 후보 풀 크기 = count * poolFactor. 생략하면 4
}

export type ShapeInfo = DifficultyScore & { singles: number };

const NONE: Range = { min: 0, max: 0 };

// 수치는 생성기 --report (크기별 300개, 시드 7) 분포의 분위에서 정한 초기값이다. 바뀌면 logic.ts 의 WEIGHTS.version 과 함께 기록한다.
export const LEVEL_CONFIGS: Record<number, LevelConfig> = {
  1: { size: 5, count: 10, maxTier: 0, t1: NONE, t2: NONE, t3: NONE, maxChain: 0, singles: { min: 1, max: 2 }, score: NONE },
  2: { size: 6, count: 10, maxTier: 1, t1: { min: 1, max: 3 }, t2: NONE, t3: NONE, maxChain: 0, singles: { min: 0, max: 1 }, score: { min: 3, max: 9 } },
  3: { size: 6, count: 10, maxTier: 2, t1: { min: 1, max: 4 }, t2: { min: 1, max: 1 }, t3: NONE, maxChain: 0, singles: { min: 0, max: 1 }, score: { min: 10, max: 18 } },
  4: { size: 7, count: 10, maxTier: 2, t1: { min: 1, max: 5 }, t2: { min: 1, max: 3 }, t3: NONE, maxChain: 0, singles: { min: 0, max: 1 }, score: { min: 15, max: 30 } },
  5: { size: 7, count: 10, maxTier: 3, t1: { min: 1, max: 6 }, t2: { min: 0, max: 4 }, t3: { min: 0, max: 2 }, maxChain: 4, singles: { min: 0, max: 1 }, score: { min: 31, max: 90 } },
};

function within(v: number, r: Range): boolean {
  return v >= r.min && v <= r.max;
}

export function countSingles(islands: number[][]): number {
  return analyzeIslands(islands).filter((s) => s.size === 1).length;
}

export function inBand(m: Measure, sh: ShapeInfo, cfg: LevelConfig): boolean {
  return (
    m.size === cfg.size &&
    m.tier <= cfg.maxTier &&
    within(m.t1, cfg.t1) &&
    within(m.t2, cfg.t2) &&
    within(m.t3, cfg.t3) &&
    m.maxChain <= cfg.maxChain &&
    within(sh.singles, cfg.singles) &&
    within(m.score, cfg.score) &&
    (!cfg.straight || within(sh.straightRatio, cfg.straight)) &&
    (cfg.maxIsland === undefined || sh.maxSize <= cfg.maxIsland)
  );
}

export function poolTarget(cfg: LevelConfig): number {
  return cfg.count * (cfg.poolFactor ?? 4);
}
