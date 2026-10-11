import { describe, expect, it } from 'vitest';
import { parseRegions, toPuzzle } from './endlessBoard';

describe('endlessBoard', () => {
  it('평탄 문자열을 2차원으로 자른다', () => {
    expect(parseRegions('0110', 2)).toEqual([[0, 1], [1, 0]]);
  });
  it('스테이지로 퍼즐을 만든다', () => {
    const p = toPuzzle({ size: 2, regions: '0110' }, [[0, 0], [1, 1]]);
    expect(p.islands).toEqual([[0, 1], [1, 0]]);
    expect(p.solution).toEqual([[0, 0], [1, 1]]);
  });
});
