import { describe, expect, it } from 'vitest';
import { countSingles, ENDLESS_BAND, inBand, LEVEL_CONFIGS, poolTarget, type LevelConfig } from './levels';
import type { Measure } from './logic';

const base: Measure = {
  size: 6, tier: 1, t0: 6, t1: 2, t2: 0, t3: 0, t3Attempts: 0, chains: [], maxChain: 0, score: 6,
};
const shape = { straightRatio: 0.5, maxSize: 10, bends: 3, singles: 1 };
const cfg: LevelConfig = {
  size: 6, count: 10, maxTier: 1,
  t1: { min: 1, max: 3 }, t2: { min: 0, max: 0 }, t3: { min: 0, max: 0 }, maxChain: 0,
  singles: { min: 0, max: 1 }, score: { min: 3, max: 9 },
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

describe('LEVEL_CONFIGS', () => {
  const levels = Object.keys(LEVEL_CONFIGS).map(Number).sort((a, b) => a - b);
  it('레벨 1~5, 각 10개, 크기 5·6·6·7·7 이다', () => {
    expect(levels).toEqual([1, 2, 3, 4, 5]);
    expect(levels.map((l) => LEVEL_CONFIGS[l].size)).toEqual([5, 6, 6, 7, 7]);
    expect(levels.every((l) => LEVEL_CONFIGS[l].count === 10)).toBe(true);
  });
  it('maxTier 는 레벨 1~4 가 2 이하, 레벨 5 가 3 이다', () => {
    expect(levels.slice(0, 4).every((l) => LEVEL_CONFIGS[l].maxTier <= 2)).toBe(true);
    expect(LEVEL_CONFIGS[5].maxTier).toBe(3);
  });
  it('같은 크기의 인접 레벨은 점수 구간이 겹치지 않고 오름차순이다', () => {
    for (let i = 1; i < levels.length; i += 1) {
      const a = LEVEL_CONFIGS[levels[i - 1]];
      const b = LEVEL_CONFIGS[levels[i]];
      if (a.size === b.size) expect(a.score.max).toBeLessThan(b.score.min);
    }
  });
  it('poolTarget 은 count 에 poolFactor(생략 시 4)를 곱한다', () => {
    expect(poolTarget(LEVEL_CONFIGS[1])).toBe(40);
    expect(poolTarget(LEVEL_CONFIGS[5])).toBe(40);
    expect(poolTarget({ ...LEVEL_CONFIGS[5], poolFactor: 2 })).toBe(20);
  });
  it('t3 를 허용하지 않는 레벨은 maxChain 이 0 이다', () => {
    for (const l of levels) {
      const c = LEVEL_CONFIGS[l];
      if (c.t3.max === 0) expect(c.maxChain).toBe(0);
    }
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
