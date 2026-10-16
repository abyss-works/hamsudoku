import { describe, expect, it } from 'vitest';
import { countsForRanking } from './rules';

// 2026-W41 집계 구간: 2026-10-04T19:00:00Z(월 04:00 KST) 이상 2026-10-11T15:00:00Z(다음 월 00:00 KST) 미만.
describe('countsForRanking', () => {
  it.each([
    ['집계 시작 정각', '2026-10-04T19:00:00.000Z', true],
    ['종료 1초 전', '2026-10-11T14:59:59.000Z', true],
    ['종료 정각', '2026-10-11T15:00:00.000Z', false],
    ['시작 전 마감 창', '2026-10-04T18:59:59.000Z', false],
  ])('%s 적립의 랭킹 대상 여부를 판정한다', (_label, at, expected) => {
    expect(countsForRanking('2026-W41', new Date(at))).toBe(expected);
  });

  it('집계 마감 창의 적립은 다음 시즌 구간에도 포함하지 않는다', () => {
    expect(countsForRanking('2026-W42', new Date('2026-10-11T17:00:00.000Z'))).toBe(false);
    expect(countsForRanking('2026-W42', new Date('2026-10-11T19:05:00.000Z'))).toBe(true);
  });
});
