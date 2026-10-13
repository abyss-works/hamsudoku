import { describe, expect, it } from 'vitest';
import { LEVEL_CONFIGS, poolTarget } from './levels';

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
