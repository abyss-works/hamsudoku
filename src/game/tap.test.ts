import { describe, expect, it } from 'vitest';
import { nextState, type TapKind } from './tap';
import type { CellState } from './puzzles';

describe('nextState', () => {
  it('싱글클릭은 빈칸과 마커를 토글한다', () => {
    expect(nextState('empty', 'single', false)).toBe('mark');
    expect(nextState('mark', 'single', false)).toBe('empty');
  });
  it('싱글클릭은 햄스터를 회수하고 오답은 잠근다', () => {
    expect(nextState('hamster', 'single', false)).toBe('empty');
    expect(nextState('wrong', 'single', false)).toBe('wrong');
  });
  it('더블클릭은 정답이면 햄스터, 오답이면 고정 빨강이다', () => {
    expect(nextState('empty', 'double', true)).toBe('hamster');
    expect(nextState('mark', 'double', true)).toBe('hamster');
    expect(nextState('empty', 'double', false)).toBe('wrong');
    expect(nextState('mark', 'double', false)).toBe('wrong');
  });
  it('더블클릭은 햄스터와 오답을 바꾸지 않는다', () => {
    const states: CellState[] = ['hamster', 'wrong'];
    for (const s of states) {
      const kind: TapKind = 'double';
      expect(nextState(s, kind, true)).toBe(s);
      expect(nextState(s, kind, false)).toBe(s);
    }
  });
});
