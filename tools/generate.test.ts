import { describe, expect, it } from 'vitest';
import { generateLevels, renderModule, runLevels } from './generate';

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
  it('같은 시드 렌더 결과는 바이트 단위로 같다', () => {
    const a = renderModule(generateLevels(1, 7), 7);
    const b = renderModule(generateLevels(1, 7), 7);
    expect(a).toBe(b);
  });
  it('실패 레벨은 건너뛰고 기록한다', () => {
    const r = runLevels(7, [99]);
    expect(r.levels).toHaveLength(0);
    expect(r.failures).toEqual([99]);
  });
});
