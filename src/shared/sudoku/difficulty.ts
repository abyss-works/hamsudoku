import type { Measure } from './logic';
import { analyzeIslands, type DifficultyScore } from './shape';

export interface Range {
  min: number;
  max: number;
}

export interface BandConfig {
  size: number;
  maxTier: 0 | 1 | 2 | 3;
  t1: Range;
  t2: Range;
  t3: Range;
  maxChain: number;
  singles: Range;
  score: Range;
  straight?: Range;
  maxIsland?: number;
}

export type ShapeInfo = DifficultyScore & { singles: number };

export const ENDLESS_BAND: BandConfig = {
  size: 7,
  maxTier: 3,
  t1: { min: 1, max: 6 },
  t2: { min: 0, max: 4 },
  t3: { min: 0, max: 2 },
  maxChain: 4,
  singles: { min: 0, max: 1 },
  score: { min: 15, max: 90 },
};

function within(value: number, range: Range): boolean {
  return value >= range.min && value <= range.max;
}

export function countSingles(islands: number[][]): number {
  return analyzeIslands(islands).filter((island) => island.size === 1).length;
}

export function inBand(measure: Measure, shape: ShapeInfo, config: BandConfig): boolean {
  return (
    measure.size === config.size &&
    measure.tier <= config.maxTier &&
    within(measure.t1, config.t1) &&
    within(measure.t2, config.t2) &&
    within(measure.t3, config.t3) &&
    measure.maxChain <= config.maxChain &&
    within(shape.singles, config.singles) &&
    within(measure.score, config.score) &&
    (!config.straight || within(shape.straightRatio, config.straight)) &&
    (config.maxIsland === undefined || shape.maxSize <= config.maxIsland)
  );
}
