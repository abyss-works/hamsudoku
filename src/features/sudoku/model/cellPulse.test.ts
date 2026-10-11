import { describe, expect, it } from 'vitest';
import { projectBoard } from './boardProjection';
import type { Puzzle } from './puzzles';
import type { Violations } from './rules';

describe('cell pulseDelay conversion', () => {
  it('pulseDelay를 초 단위 pulseDelaySec로 변환하며 undefined, 0, 250ms, 1000ms를 정확히 제공한다', () => {
    const puzzle: Puzzle = {
      name: '테스트',
      size: 2,
      islands: [
        [0, 1],
        [1, 0],
      ],
      solution: [
        [0, 1],
        [1, 0],
      ],
    };
    const cells = [
      ['empty', 'empty'],
      ['empty', 'empty'],
    ] as any;
    const pulse = new Map<string, number>([
      ['0,1', 0],
      ['1,0', 250],
      ['1,1', 1000],
    ]);
    const violations: Violations = {
      rows: new Set<number>(),
      cols: new Set<number>(),
      islands: new Set<number>(),
      touch: new Set<string>(),
    };
    const projected = projectBoard(cells, puzzle, new Set(), violations, pulse, null);

    // [0,0]: pulse 없음 -> pulseDelay undefined, pulseDelaySec 0
    expect(projected[0][0].pulseDelay).toBeUndefined();
    expect(projected[0][0].pulseDelaySec).toBe(0);

    // [0,1]: pulse 0 -> pulseDelay 0, pulseDelaySec 0
    expect(projected[0][1].pulseDelay).toBe(0);
    expect(projected[0][1].pulseDelaySec).toBe(0);

    // [1,0]: pulse 250 -> pulseDelay 250, pulseDelaySec 0.25
    expect(projected[1][0].pulseDelay).toBe(250);
    expect(projected[1][0].pulseDelaySec).toBe(0.25);

    // [1,1]: pulse 1000 -> pulseDelay 1000, pulseDelaySec 1
    expect(projected[1][1].pulseDelay).toBe(1000);
    expect(projected[1][1].pulseDelaySec).toBe(1);
  });
});
