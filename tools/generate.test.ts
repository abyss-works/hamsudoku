import { describe, expect, it } from 'vitest';
import { generateLevel, pickSpread, quantile, renderModule, runLevels, summarize } from './generate';
import type { GeneratedLevel } from '../src/game/levels';

describe('pickSpread', () => {
  it('정렬된 풀에서 등간격 인덱스로 count 개를 고른다', () => {
    const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    expect(pickSpread(pool, 4)).toEqual([0, 4, 7, 11]);
  });
  it('풀 크기가 count 와 같으면 전부 고른다', () => {
    expect(pickSpread([1, 2, 3], 3)).toEqual([1, 2, 3]);
  });
});

describe('quantile', () => {
  it('정렬된 값의 분위수를 낸다', () => {
    const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(quantile(v, 0)).toBe(1);
    expect(quantile(v, 50)).toBe(5.5);
    expect(quantile(v, 100)).toBe(10);
  });
});

describe('summarize', () => {
  it('tier 분포와 분위수, singles 분포를 낸다', () => {
    const rows = [
      { tier: 0, t1: 0, t2: 0, t3: 0, maxChain: 0, score: 0, singles: 1 },
      { tier: 1, t1: 2, t2: 0, t3: 0, maxChain: 0, score: 6, singles: 0 },
      { tier: 2, t1: 1, t2: 1, t3: 0, maxChain: 0, score: 9, singles: 2 },
    ];
    const s = summarize(rows);
    expect(s.tiers).toEqual({ 0: 1, 1: 1, 2: 1, 3: 0, 4: 0 });
    expect(s.score[50]).toBe(6);
    expect(s.singles).toEqual({ 0: 1, 1: 1, 2: 1 });
  });
});

describe('renderModule', () => {
  it('헤더에 시드·가중치 버전·밴드·레벨별 풀 정보를 적는다', () => {
    const lv: GeneratedLevel = {
      level: 1, no: 1, code: '1-1',
      puzzle: { name: '', size: 5, islands: [[0]], solution: [[0, 0]] },
      measure: { size: 5, tier: 0, t0: 5, t1: 0, t2: 0, t3: 0, t3Attempts: 0, chains: [], maxChain: 0, score: 0 },
    };
    const text = renderModule([lv], 7, [{ level: 1, pool: 40, scoreMin: 0, scoreMax: 0 }]);
    expect(text).toContain('--seed 7');
    expect(text).toContain('가중치: w1');
    expect(text).toContain('레벨 1: 풀 40, 점수 0~0');
    expect(text).toContain('"measure"');
  });
});

describe('generateLevel', () => {
  it('고정 시드 출력의 해시가 같고 count 개를 낸다', () => {
    const a = JSON.stringify(generateLevel(1, 7));
    const b = JSON.stringify(generateLevel(1, 7));
    expect(a).toBe(b);
    expect(JSON.parse(a).levels).toHaveLength(10);
  });
  it('빈칸 없이 섬이 보드를 덮고 측정값을 함께 담는다', () => {
    for (const lv of generateLevel(1, 7).levels) {
      const flat = lv.puzzle.islands.flat();
      expect(flat).toHaveLength(25);
      expect(new Set(flat).size).toBe(5);
      expect(lv.measure.tier).toBe(0);
    }
  });
  it('같은 시드 렌더 결과는 바이트 단위로 같다', () => {
    const r1 = generateLevel(1, 7);
    const r2 = generateLevel(1, 7);
    expect(renderModule(r1.levels, 7, [r1.info])).toBe(renderModule(r2.levels, 7, [r2.info]));
  });
  it('실패 레벨은 건너뛰고 기록한다', () => {
    const r = runLevels(7, [99]);
    expect(r.levels).toHaveLength(0);
    expect(r.failures).toEqual([99]);
  });
});
