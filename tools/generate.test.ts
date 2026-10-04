import { describe, expect, it } from 'vitest';
import { generateLevels } from './generate';

describe('generateLevels', () => {
  it('고정 시드 출력의 해시가 같다', () => {
    const a = JSON.stringify(generateLevels(1, 7));
    const b = JSON.stringify(generateLevels(1, 7));
    expect(a).toBe(b);
    expect(JSON.parse(a)).toHaveLength(10);
  });
  it('빈칸 없이 섬이 보드를 덮는다', () => {
    for (const lv of generateLevels(1, 7)) {
      const flat = lv.puzzle.islands.flat();
      expect(flat).toHaveLength(25);
      expect(new Set(flat).size).toBe(5);
    }
  });
});
