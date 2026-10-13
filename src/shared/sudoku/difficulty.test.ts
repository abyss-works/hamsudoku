import { describe, expect, it } from 'vitest';
import { countSingles, ENDLESS_BAND, inBand } from './difficulty';
import type { Measure } from './logic';

const base: Measure = {
  size: 6, tier: 1, t0: 6, t1: 2, t2: 0, t3: 0, t3Attempts: 0, chains: [], maxChain: 0, score: 6,
};
const shape = { straightRatio: 0.5, maxSize: 10, bends: 3, singles: 1 };
const cfg = {
  size: 6,
  maxTier: 1 as const,
  t1: { min: 1, max: 3 },
  t2: { min: 0, max: 0 },
  t3: { min: 0, max: 0 },
  maxChain: 0,
  singles: { min: 0, max: 1 },
  score: { min: 3, max: 9 },
};

describe('inBand', () => {
  it('모든 구간 안이면 참이다', () => {
    expect(inBand(base, shape, cfg)).toBe(true);
  });
  it('tier 가 상한을 넘으면 거짓이다', () => {
    expect(inBand({ ...base, tier: 2, t2: 1 }, shape, { ...cfg, t2: { min: 0, max: 1 }, score: { min: 0, max: 99 } })).toBe(false);
  });
  it('t1 횟수가 구간 밖이면 거짓이다', () => {
    expect(inBand({ ...base, t1: 4 }, shape, { ...cfg, score: { min: 0, max: 99 } })).toBe(false);
  });
  it('점수가 구간 밖이면 거짓이다', () => {
    expect(inBand({ ...base, score: 10 }, shape, cfg)).toBe(false);
  });
  it('한 칸 섬 수가 구간 밖이면 거짓이다', () => {
    expect(inBand(base, { ...shape, singles: 2 }, cfg)).toBe(false);
  });
  it('보조 필터 straight·maxIsland 는 있을 때만 적용한다', () => {
    expect(inBand(base, shape, { ...cfg, straight: { min: 0.6, max: 1 } })).toBe(false);
    expect(inBand(base, shape, { ...cfg, maxIsland: 9 })).toBe(false);
    expect(inBand(base, shape, { ...cfg, maxIsland: 10 })).toBe(true);
  });
  it('크기가 다르면 거짓이다', () => {
    expect(inBand({ ...base, size: 5 }, shape, cfg)).toBe(false);
  });
});

describe('countSingles', () => {
  it('한 칸짜리 섬 수를 센다', () => {
    expect(countSingles([[0, 1, 1], [2, 2, 1], [2, 2, 1]])).toBe(1);
    expect(countSingles([[0, 0, 1], [0, 0, 1], [2, 2, 1]])).toBe(0);
  });
});

describe('ENDLESS_BAND', () => {
  const m7: Measure = {
    size: 7, tier: 2, t0: 30, t1: 3, t2: 1, t3: 0, t3Attempts: 0, chains: [], maxChain: 0, score: 20,
  };
  it('레벨 4·5 수준 후보를 통과시킨다', () => {
    expect(inBand(m7, shape, ENDLESS_BAND)).toBe(true);
    expect(inBand({ ...m7, tier: 3, t1: 4, t2: 2, t3: 1, maxChain: 3, score: 60 }, shape, ENDLESS_BAND)).toBe(true);
  });
  it('범위 밖 후보를 거른다', () => {
    expect(inBand({ ...m7, size: 6 }, shape, ENDLESS_BAND)).toBe(false);
    expect(inBand({ ...m7, tier: 4 }, shape, ENDLESS_BAND)).toBe(false);
    expect(inBand({ ...m7, score: 100 }, shape, ENDLESS_BAND)).toBe(false);
    expect(inBand({ ...m7, score: 14 }, shape, ENDLESS_BAND)).toBe(false);
  });
});
