import { describe, expect, it } from 'vitest';
import { stageCatalog } from './catalog';
import { isStageCode } from '../../../shared/stageCodes';

describe('stageCatalog', () => {
  it('카탈로그의 모든 코드는 공유 스테이지 코드 판정을 통과한다', () => {
    const codes = stageCatalog().flatMap((c) => c.stages.map((s) => s.code));
    expect(codes).toHaveLength(50);
    expect(codes.every(isStageCode)).toBe(true);
  });
});
