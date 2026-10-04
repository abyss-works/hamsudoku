import { describe, expect, it } from 'vitest';
import { PUZZLES } from './puzzles';
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
