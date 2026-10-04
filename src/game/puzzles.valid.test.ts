import { describe, expect, it } from 'vitest';
import { LEVELS } from './levels.generated';
import { PUZZLES } from './puzzles';
import { scoreDifficulty } from './shape';
import { checkIslands, countSolutions } from './solver';

for (const puzzle of PUZZLES) {
  describe(`레벨 검증: ${puzzle.name}`, () => {
    it('섬 id가 0부터 연속되고 각 섬이 직교 연속이다', () => {
      expect(checkIslands(puzzle.islands)).toEqual([]);
    });
    it('해가 정확히 1개이며 저장된 solution과 일치한다', () => {
      const sols = countSolutions(puzzle.islands, 2);
      expect(sols).toHaveLength(1);
      const got = new Set(sols[0].map(([r, c]) => `${r},${c}`));
      const want = new Set(puzzle.solution.map(([r, c]) => `${r},${c}`));
      expect(got).toEqual(want);
    });
  });
}

const BANDS: Record<number, { minStraight: number; maxStraight: number }> = {
  1: { minStraight: 0.6, maxStraight: 1 },
  2: { minStraight: 0.3, maxStraight: 0.6 },
  3: { minStraight: 0, maxStraight: 1 },
};

for (const lv of LEVELS) {
  describe(`생성 검증: ${lv.code}`, () => {
    it('섬이 연속되고 해가 1개이며 solution과 일치한다', () => {
      expect(checkIslands(lv.puzzle.islands)).toEqual([]);
      const sols = countSolutions(lv.puzzle.islands, 2);
      expect(sols).toHaveLength(1);
      const got = new Set(sols[0].map(([r, c]) => `${r},${c}`));
      const want = new Set(lv.puzzle.solution.map(([r, c]) => `${r},${c}`));
      expect(got).toEqual(want);
    });
    it('레벨 밴드에 든다', () => {
      const band = BANDS[lv.level];
      const score = scoreDifficulty(lv.puzzle.islands);
      expect(score.straightRatio).toBeGreaterThanOrEqual(band.minStraight);
      expect(score.straightRatio).toBeLessThanOrEqual(band.maxStraight);
    });
  });
}
