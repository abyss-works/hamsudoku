import { describe, expect, it } from 'vitest';
import { delayForPointerType, nextState, spreadMarks, type TapKind } from './tap';
import type { CellState } from './puzzles';

describe('nextState', () => {
  it('싱글클릭은 빈칸과 마커를 토글한다', () => {
    expect(nextState('empty', 'single', false)).toBe('mark');
    expect(nextState('mark', 'single', false)).toBe('empty');
  });
  it('싱글클릭은 앵커를 지운다', () => {
    expect(nextState('anchor', 'single', false)).toBe('empty');
  });
  it('싱글클릭은 조각을 건드리지 않는다', () => {
    expect(nextState('frag', 'single', false)).toBe('frag');
  });
  it('싱글클릭은 햄스터를 회수하고 오답은 잠근다', () => {
    expect(nextState('hamster', 'single', false)).toBe('empty');
    expect(nextState('wrong', 'single', false)).toBe('wrong');
  });
  it('더블클릭은 정답이면 햄스터, 오답이면 고정 빨강이다', () => {
    expect(nextState('empty', 'double', true)).toBe('hamster');
    expect(nextState('mark', 'double', true)).toBe('hamster');
    expect(nextState('anchor', 'double', true)).toBe('hamster');
    expect(nextState('empty', 'double', false)).toBe('wrong');
    expect(nextState('mark', 'double', false)).toBe('wrong');
    expect(nextState('anchor', 'double', false)).toBe('wrong');
  });
  it('더블클릭은 조각을 건드리지 않는다', () => {
    expect(nextState('frag', 'double', true)).toBe('frag');
    expect(nextState('frag', 'double', false)).toBe('frag');
  });
  it('더블클릭은 햄스터와 오답을 바꾸지 않는다', () => {
    const states: CellState[] = ['hamster', 'wrong', 'auto'];
    for (const s of states) {
      const kind: TapKind = 'double';
      expect(nextState(s, kind, true)).toBe(s);
      expect(nextState(s, kind, false)).toBe(s);
    }
  });
  it('자동 마커는 싱글로도 안 풀린다', () => {
    expect(nextState('auto', 'single', false)).toBe('auto');
  });
});

describe('delayForPointerType', () => {
  it('터치는 130ms, 나머지는 80ms다', () => {
    expect(delayForPointerType('touch')).toBe(130);
    expect(delayForPointerType('mouse')).toBe(80);
    expect(delayForPointerType('pen')).toBe(80);
    expect(delayForPointerType(null)).toBe(80);
  });
});

describe('spreadMarks', () => {
  it('같은 줄과 주변 8칸을 거리순 딜레이로 낸다', () => {
    const marks = spreadMarks(5, 2, 2);
    const byKey = new Map(marks.map((m) => [`${m.r},${m.c}`, m.delayMs]));
    expect(byKey.get('2,0')).toBe(120);
    expect(byKey.get('2,4')).toBe(120);
    expect(byKey.get('1,1')).toBe(60);
    expect(byKey.get('2,2')).toBeUndefined();
    expect(marks.length).toBe(new Set(marks.map((m) => `${m.r},${m.c}`)).size);
  });
});
