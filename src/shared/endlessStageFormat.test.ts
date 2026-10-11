import { describe, expect, it } from 'vitest';
import { serializeRegions, serializeSolution, stageId } from './endlessStageFormat';

describe('endlessStageFormat', () => {
  it('serializeRegions formats 2D islands array to flat string', () => {
    const islands = [
      [0, 0, 1],
      [1, 2, 2],
    ];
    expect(serializeRegions(islands)).toBe('001122');
  });

  it('serializeSolution formats coordinate pairs joined by semicolon', () => {
    const solution: [number, number][] = [
      [0, 1],
      [1, 3],
      [2, 0],
    ];
    expect(serializeSolution(solution)).toBe('0,1;1,3;2,0');
  });

  it('stageId creates stable endless stage identifier', () => {
    expect(stageId(10001, 0)).toBe('e-10001-0');
    expect(stageId(10001, 9)).toBe('e-10001-9');
  });
});
