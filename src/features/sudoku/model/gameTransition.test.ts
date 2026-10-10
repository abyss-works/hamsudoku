import { describe, expect, it } from 'vitest';
import * as transitions from './gameTransition';
import { PUZZLES } from './puzzles';

describe('game transitions', () => {
  it('입력 상태를 유지하며 덮인 X를 앵커 회수 때 복원한다', () => {
    const initial = transitions.createGameState(5);
    const marked = transitions.transitionGame(initial, PUZZLES[0], { type: 'tap', r: 2, c: 0, kind: 'single' });
    const probing = transitions.transitionGame(marked.state, PUZZLES[0], { type: 'probe', on: true });
    const placed = transitions.transitionGame(probing.state, PUZZLES[0], { type: 'tap', r: 2, c: 2, kind: 'single' });
    const recalled = transitions.transitionGame(placed.state, PUZZLES[0], { type: 'tap', r: 2, c: 2, kind: 'single' });
    expect(initial.cells[2][0]).toBe('empty');
    expect(marked.state.cells[2][0]).toBe('mark');
    expect(placed.state.cells[2][0]).toBe('frag');
    expect(recalled.state.cells[2][0]).toBe('mark');
    expect(recalled.sounds).toEqual(['erase']);
  });

  it('스트로크에서 각 칸을 한 번만 변경하고 reset은 스트로크를 해제한다', () => {
    let state = transitions.createGameState(5);
    for (const action of [
      { type: 'begin', r: 0, c: 0 },
      { type: 'enter', r: 0, c: 1 },
      { type: 'enter', r: 0, c: 1 },
    ] as const) state = transitions.transitionGame(state, PUZZLES[0], action).state;
    expect(state.cells[0].slice(0, 2)).toEqual(['mark', 'mark']);
    const reset = transitions.transitionGame(state, PUZZLES[0], { type: 'reset' });
    expect(reset.state.stroke).toBeNull();
    expect(state.cells[0][0]).toBe('mark');
  });
});
