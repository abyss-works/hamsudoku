import { describe, expect, it } from 'vitest';
import { analyzeIslands, scoreDifficulty } from './shape';

const MAP = [
  [0, 0, 1, 1, 1],
  [2, 2, 1, 1, 1],
  [2, 2, 2, 3, 3],
  [4, 2, 3, 3, 3],
  [4, 4, 4, 3, 3],
];

describe('analyzeIslands', () => {
  it('섬 통계를 잰다', () => {
    const stats = analyzeIslands(MAP);
    expect(stats.find((s) => s.id === 0)).toMatchObject({ size: 2, rowSpan: 1, colSpan: 2, straight: true, bends: 0 });
    expect(stats.find((s) => s.id === 2)?.straight).toBe(false);
  });
});

describe('scoreDifficulty', () => {
  it('일자섬 비율과 최대 크기, 꺾임 합을 낸다', () => {
    const score = scoreDifficulty(MAP);
    expect(score.straightRatio).toBeCloseTo(0.2, 5);
    expect(score.maxSize).toBe(7);
  });
});
