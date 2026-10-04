import { describe, expect, it } from 'vitest';
import { fetchStages } from './stagesApi';

describe('fetchStages', () => {
  it('장 3개, 스테이지 30개를 반환하고 잠금은 모두 false다', async () => {
    const chapters = await fetchStages();
    expect(chapters.map((c) => c.title)).toEqual(['레벨 1', '레벨 2', '레벨 3']);
    const stages = chapters.flatMap((c) => c.stages);
    expect(stages).toHaveLength(30);
    expect(stages[0].code).toBe('1-1');
    expect(stages[29].code).toBe('3-10');
    expect(stages.every((s) => s.locked === false)).toBe(true);
  });
});
