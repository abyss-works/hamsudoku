import { describe, expect, it } from 'vitest';
import { fetchStages } from './stagesApi';

describe('fetchStages', () => {
  it('장 5개, 스테이지 50개를 반환하고 잠금은 모두 false다', async () => {
    const chapters = await fetchStages();
    expect(chapters.map((c) => c.title)).toEqual(['레벨 1', '레벨 2', '레벨 3', '레벨 4', '레벨 5']);
    const stages = chapters.flatMap((c) => c.stages);
    expect(stages).toHaveLength(50);
    expect(stages[0].code).toBe('1-1');
    expect(stages[49].code).toBe('5-10');
    expect(stages.every((s) => s.locked === false)).toBe(true);
  });
});
