import { describe, expect, it } from 'vitest';
import { serializeRegions, serializeSolution, stageId } from './load-pool';

describe('load-pool 직렬화', () => {
  it('섬 지도를 평탄 숫자 문자열로 만든다', () => {
    expect(serializeRegions([[0, 1], [2, 2]])).toBe('0122');
  });
  it('정답 좌표를 r,c 목록으로 만든다', () => {
    expect(serializeSolution([[0, 1], [1, 0]])).toBe('0,1;1,0');
  });
  it('스테이지 id는 시드와 순번으로 만든다', () => {
    expect(stageId(7, 3)).toBe('e-7-3');
  });
});
