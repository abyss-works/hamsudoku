import { describe, expect, it } from 'vitest';
import { generateEndlessPool, validateEndlessCandidate } from './endlessPoolGenerator';
import type { Pos } from './solver';

describe('validateEndlessCandidate', () => {
  it('보드에 유일해가 있어도 제공된 해답이 다르면 적재 검증을 거부한다', () => {
    const candidate = {
      islands: [
        [0, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 2, 2, 1],
        [1, 1, 1, 4, 2, 3, 3], [4, 4, 4, 4, 2, 5, 5], [4, 4, 4, 4, 4, 5, 5], [6, 6, 4, 4, 4, 5, 5],
      ],
      solution: [[0, 0], [1, 2], [2, 4], [3, 6], [4, 3], [5, 5], [6, 1]] as Pos[],
      tier: 2,
    };
    expect(validateEndlessCandidate(candidate)).toBe(true);
    expect(validateEndlessCandidate({ ...candidate, solution: [...candidate.solution].reverse() })).toBe(true);
    const wrong = [0, 2, 4, 5, 3, 6, 1].map((c, r) => [r, c] as Pos);
    expect(validateEndlessCandidate({ ...candidate, solution: wrong })).toBe(false);
  });

  it('7x7이 아닌 후보는 거부한다', () => {
    expect(validateEndlessCandidate({ islands: [[0, 1], [0, 1]], solution: [[0, 0], [1, 1]] as Pos[], tier: 1 })).toBe(false);
  });
});

describe('generateEndlessPool', () => {
  it('후보 10개를 만들어 모두 적재 검증을 통과하고 같은 시드는 같은 순서의 후보를 만든다', () => {
    const first = generateEndlessPool(30000, 10);
    expect(first).toHaveLength(10);
    expect(first.every((candidate) => validateEndlessCandidate(candidate))).toBe(true);
    expect(generateEndlessPool(30000, 2)).toEqual(first.slice(0, 2));
  }, 180_000);
});
