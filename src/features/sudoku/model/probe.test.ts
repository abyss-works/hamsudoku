import { describe, expect, it } from 'vitest';
import { ownedProbeCells, resolveMark } from './probe';
import type { CellState } from './puzzles';

function board(): CellState[][] {
  return Array.from({ length: 5 }, () => Array<CellState>(5).fill('empty'));
}

describe('resolveMark', () => {
  it('덮인 조각은 X로 본다', () => {
    expect(resolveMark('frag', true)).toBe('mark');
  });
  it('맨 조각·다른 상태는 그대로 둔다', () => {
    expect(resolveMark('frag', false)).toBe('frag');
    expect(resolveMark('mark', false)).toBe('mark');
    expect(resolveMark('anchor', false)).toBe('anchor');
    expect(resolveMark('empty', false)).toBe('empty');
  });
});

describe('ownedProbeCells', () => {
  it('겹친 소유자별로 조각과 앵커 아래의 임시 표시를 모은다', () => {
    const cells = board();
    cells[2][2] = 'anchor';
    cells[2][0] = 'frag';
    cells[0][2] = 'frag';
    cells[1][1] = 'anchor';
    cells[0][0] = 'auto';
    const links = new Map([
      ['2,0', new Set(['2,2', '0,0'])],
      ['0,2', new Set(['2,2'])],
      ['1,1', new Set(['2,2'])],
      ['0,0', new Set(['2,2'])],
    ]);
    expect(ownedProbeCells(links, cells, '2,2').sort()).toEqual(['0,2', '1,1', '2,0']);
    expect(ownedProbeCells(links, cells, '0,0')).toEqual(['2,0']);
  });
});
