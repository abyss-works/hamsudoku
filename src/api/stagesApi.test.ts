import { describe, expect, it } from 'vitest';
import { fetchStages } from './stagesApi';

describe('fetchStages', () => {
  it('장 2개, 스테이지 2개를 반환하고 잠금은 모두 false다', async () => {
    const chapters = await fetchStages();
    expect(chapters.map((c) => c.title)).toEqual(['레벨 1', '레벨 2']);
    const stages = chapters.flatMap((c) => c.stages);
    expect(stages.map((s) => s.code)).toEqual(['1-1', '2-1']);
    expect(stages.every((s) => s.locked === false)).toBe(true);
  });
});
