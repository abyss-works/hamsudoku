import { describe, expect, it } from 'vitest';
import { countSingles, inBand, LEVEL_CONFIGS } from './levels';
import { LEVELS } from './levels.generated';
import { measure, measureWithTrace } from './logic';
import { PUZZLES } from './puzzles';
import { scoreDifficulty } from './shape';
import { checkIslands, countSolutions } from './solver';

const key = (p: readonly [number, number]) => `${p[0]},${p[1]}`;

for (const puzzle of PUZZLES) {
  describe(`레벨 검증: ${puzzle.name}`, () => {
    it('섬 id가 0부터 연속되고 각 섬이 직교 연속이다', () => {
      expect(checkIslands(puzzle.islands)).toEqual([]);
    });
    it('해가 정확히 1개이며 저장된 solution과 일치한다', () => {
      const sols = countSolutions(puzzle.islands, 2);
      expect(sols).toHaveLength(1);
      expect(new Set(sols[0].map(key))).toEqual(new Set(puzzle.solution.map(key)));
    });
  });
}

for (const lv of LEVELS) {
  describe(`생성 검증: ${lv.code}`, () => {
    it('섬이 연속되고 해가 1개이며 solution과 일치한다', () => {
      expect(checkIslands(lv.puzzle.islands)).toEqual([]);
      const sols = countSolutions(lv.puzzle.islands, 2);
      expect(sols).toHaveLength(1);
      expect(new Set(sols[0].map(key))).toEqual(new Set(lv.puzzle.solution.map(key)));
    });
    it('측정값이 산출물과 같고 두 번 재도 같다', () => {
      expect(measure(lv.puzzle.islands)).toEqual(lv.measure);
      expect(measure(lv.puzzle.islands)).toEqual(measure(lv.puzzle.islands));
    });
    it('레벨 밴드에 들고 tier 가 4 미만이다', () => {
      const shape = { ...scoreDifficulty(lv.puzzle.islands), singles: countSingles(lv.puzzle.islands) };
      expect(lv.measure.tier).toBeLessThan(4);
      expect(inBand(lv.measure, shape, LEVEL_CONFIGS[lv.level])).toBe(true);
    });
    it('추론 과정에서 소거한 칸이 정답에 없고 배치가 정답과 같다', () => {
      const { trace } = measureWithTrace(lv.puzzle.islands);
      const sol = new Set(lv.puzzle.solution.map(key));
      const placed = trace.filter((t) => t.kind === 'place').map((t) => key(t.cell));
      const eliminated = trace.filter((t) => t.kind === 'eliminate').map((t) => key(t.cell));
      expect(new Set(placed)).toEqual(sol);
      expect(eliminated.some((c) => sol.has(c))).toBe(false);
    });
  });
}

describe('레벨 구성', () => {
  const levels = [...new Set(LEVELS.map((lv) => lv.level))].sort((a, b) => a - b);

  it('LEVEL_CONFIGS 의 모든 레벨이 count 개씩 있고 번호가 1부터 연속이다', () => {
    expect(levels).toEqual(Object.keys(LEVEL_CONFIGS).map(Number).sort((a, b) => a - b));
    for (const level of levels) {
      const nos = LEVELS.filter((lv) => lv.level === level).map((lv) => lv.no);
      expect(nos).toEqual([...Array(LEVEL_CONFIGS[level].count).keys()].map((i) => i + 1));
    }
  });

  it('레벨 안에서 번호순으로 점수가 비감소다', () => {
    for (const level of levels) {
      const scores = LEVELS.filter((lv) => lv.level === level).map((lv) => lv.measure.score);
      for (let i = 1; i < scores.length; i += 1) expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }
  });

  it('같은 크기의 인접 레벨은 점수 구간이 겹치지 않는다', () => {
    for (let i = 1; i < levels.length; i += 1) {
      const a = LEVELS.filter((lv) => lv.level === levels[i - 1]);
      const b = LEVELS.filter((lv) => lv.level === levels[i]);
      if (a[0].puzzle.size !== b[0].puzzle.size) continue;
      const aMax = Math.max(...a.map((lv) => lv.measure.score));
      const bMin = Math.min(...b.map((lv) => lv.measure.score));
      expect(aMax).toBeLessThan(bMin);
    }
  });

  it('섬 지도가 서로 다르다', () => {
    const keys = LEVELS.map((lv) => JSON.stringify(lv.puzzle.islands));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
