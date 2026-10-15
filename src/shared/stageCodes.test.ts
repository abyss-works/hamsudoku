import { describe, expect, it } from 'vitest';
import { isStageCode } from './stageCodes';

describe('isStageCode', () => {
  it('레벨 1~5, 번호 1~10의 스테이지 코드를 인정한다', () => {
    expect(isStageCode('1-1')).toBe(true);
    expect(isStageCode('5-10')).toBe(true);
  });
  it('무한모드 판 식별자와 범위 밖 코드를 거른다', () => {
    expect(isStageCode('e-1-3')).toBe(false);
    expect(isStageCode('6-1')).toBe(false);
    expect(isStageCode('1-11')).toBe(false);
    expect(isStageCode('1-0')).toBe(false);
    expect(isStageCode('')).toBe(false);
  });
});
