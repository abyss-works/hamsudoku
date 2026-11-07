import { describe, expect, it } from 'vitest';
import * as transitions from './gameTransition';
import { PUZZLES } from './puzzles';
import { projectBoard } from './boardProjection';

describe('game transitions', () => {
  it.each([false, true])('임시 정답 모드 %s에서 확정 정답의 반복 입력을 무시한다', (probeActive) => {
    const puzzle = PUZZLES[0];
    const [r, c] = puzzle.solution[0];
    const confirmed = transitions.transitionGame(transitions.createGameState(puzzle.size), puzzle,
      { type: 'tap', r, c, kind: 'double' });
    let state = transitions.transitionGame(confirmed.state, puzzle, { type: 'probe', on: probeActive }).state;
    for (const kind of ['single', 'double', 'single'] as const) {
      const next = transitions.transitionGame(state, puzzle, { type: 'tap', r, c, kind });
      expect(next.state.cells).toEqual(confirmed.state.cells);
      expect(next.state.cells[r][c]).toBe('hamster');
      expect(next.sounds).toEqual([]);
      expect(next.completed).toBe(false);
      state = next.state;
    }
  });

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

  it('확정 마커가 임시 조각을 덮고 앵커 회수 뒤에도 남는다', () => {
    const puzzle = PUZZLES[0];
    let state = transitions.createGameState(puzzle.size);
    state = transitions.transitionGame(state, puzzle, { type: 'tap', r: 1, c: 1, kind: 'single' }).state;
    state = transitions.transitionGame(state, puzzle, { type: 'probe', on: true }).state;
    state = transitions.transitionGame(state, puzzle, { type: 'tap', r: 2, c: 2, kind: 'single' }).state;
    state = transitions.transitionGame(state, puzzle, { type: 'probe', on: false }).state;

    const answered = transitions.transitionGame(state, puzzle, { type: 'tap', r: 0, c: 0, kind: 'double' }).state;
    expect(answered.cells[1][1]).toBe('frag');
    expect(answered.underlay.get('1,1')).toBe('mark');
    expect(answered.autoMarks.has('1,1')).toBe(true);
    const answeredView = transitions.projectGame(answered, puzzle);
    expect(projectBoard(answeredView.cells, puzzle, answeredView.xMarks, answeredView.violations,
      answeredView.pulse, answeredView.hitKey, answeredView.autoMarks)[1][1].state).toBe('auto');

    const locked = transitions.transitionGame(answered, puzzle, { type: 'tap', r: 1, c: 1, kind: 'single' }).state;
    expect(locked.cells[1][1]).toBe('frag');
    expect(locked.underlay.get('1,1')).toBe('mark');

    const recallMode = transitions.transitionGame(locked, puzzle, { type: 'probe', on: true }).state;
    const recalled = transitions.transitionGame(recallMode, puzzle, { type: 'tap', r: 2, c: 2, kind: 'single' }).state;
    expect(recalled.cells[1][1]).toBe('mark');
    expect(recalled.underlay.has('1,1')).toBe(false);
    expect(recalled.autoMarks.has('1,1')).toBe(true);

    const recalledView = transitions.projectGame(recalled, puzzle);
    expect(projectBoard(recalledView.cells, puzzle, recalledView.xMarks, recalledView.violations,
      recalledView.pulse, recalledView.hitKey, recalledView.autoMarks)[1][1].state).toBe('auto');

    const reset = transitions.transitionGame(recalled, puzzle, { type: 'reset' }).state;
    expect(reset.autoMarks.size).toBe(0);
  });

  it('정답 전파가 인접 앵커와 소유 조각을 회수하고 자동 X를 남긴다', () => {
    const puzzle = PUZZLES[0];
    const solution = puzzle.solution.find(([r, c]) => r + 1 < puzzle.size && c + 1 < puzzle.size);
    expect(solution).toBeDefined();
    if (!solution) return;
    const [r, c] = solution;
    const anchorR = r + 1;
    const anchorC = c + 1;
    const anchorKey = `${anchorR},${anchorC}`;
    const restoredMarkR = anchorR;
    const restoredMarkC = c;
    const restoredMarkKey = `${restoredMarkR},${restoredMarkC}`;
    let state = transitions.createGameState(puzzle.size);
    state = transitions.transitionGame(state, puzzle, { type: 'tap', r, c, kind: 'single' }).state;
    state = transitions.transitionGame(state, puzzle,
      { type: 'tap', r: restoredMarkR, c: restoredMarkC, kind: 'single' }).state;
    state = transitions.transitionGame(state, puzzle, { type: 'probe', on: true }).state;
    state = transitions.transitionGame(state, puzzle, { type: 'tap', r: anchorR, c: anchorC, kind: 'single' }).state;
    const ownedFrags = [...state.probeOwners.entries()]
      .filter(([, owners]) => owners.has(anchorKey))
      .map(([fragment]) => fragment);
    expect(ownedFrags).toContain(`${r},${c}`);
    expect(ownedFrags).toContain(restoredMarkKey);
    expect(state.cells[r][c]).toBe('frag');
    expect(state.underlay.get(`${r},${c}`)).toBe('mark');
    expect(state.cells[restoredMarkR][restoredMarkC]).toBe('frag');
    expect(state.underlay.get(restoredMarkKey)).toBe('mark');
    state = transitions.transitionGame(state, puzzle, { type: 'probe', on: false }).state;

    const answer = transitions.transitionGame(state, puzzle, { type: 'tap', r, c, kind: 'double' });
    const answered = answer.state;
    expect(answered.cells[r][c]).toBe('hamster');
    expect(answered.cells[anchorR][anchorC]).toBe('empty');
    expect(answered.cells[restoredMarkR][restoredMarkC]).toBe('mark');
    expect(answered.underlay.has(restoredMarkKey)).toBe(false);
    expect([...answered.probeOwners.values()].some((owners) => owners.has(anchorKey))).toBe(false);
    for (const fragment of ownedFrags) {
      const [fragmentR, fragmentC] = fragment.split(',').map(Number);
      if (fragment !== `${r},${c}`) expect(answered.cells[fragmentR][fragmentC]).not.toBe('frag');
    }
    expect(answered.autoMarks.has(anchorKey)).toBe(true);
    expect(answered.autoMarks.has(restoredMarkKey)).toBe(true);
    expect(answer.sounds).toEqual(['erase', 'correct']);
    const answeredView = transitions.projectGame(answered, puzzle);
    expect(projectBoard(answeredView.cells, puzzle, answeredView.xMarks, answeredView.violations,
      answeredView.pulse, answeredView.hitKey, answeredView.autoMarks)[anchorR][anchorC].state).toBe('auto');
    expect(projectBoard(answeredView.cells, puzzle, answeredView.xMarks, answeredView.violations,
      answeredView.pulse, answeredView.hitKey, answeredView.autoMarks)[restoredMarkR][restoredMarkC].state).toBe('auto');
  });

  it('겹친 임시 정답을 회수해도 남은 임시 정답과 세 마커 상태를 보존한다', () => {
    const puzzle = PUZZLES[0];
    let state = transitions.createGameState(puzzle.size);
    state = transitions.transitionGame(state, puzzle, { type: 'tap', r: 0, c: 2, kind: 'single' }).state;
    state = transitions.transitionGame(state, puzzle, { type: 'tap', r: 1, c: 3, kind: 'single' }).state;
    state = transitions.transitionGame(state, puzzle, { type: 'tap', r: 0, c: 0, kind: 'double' }).state;
    state = transitions.transitionGame(state, puzzle, { type: 'probe', on: true }).state;
    state = transitions.transitionGame(state, puzzle, { type: 'tap', r: 1, c: 2, kind: 'single' }).state;
    state = transitions.transitionGame(state, puzzle, { type: 'tap', r: 1, c: 3, kind: 'single' }).state;

    expect(state.cells[0][2]).toBe('frag');
    expect(state.cells[1][3]).toBe('anchor');
    expect(state.underlay.get('0,2')).toBe('mark');
    expect(state.autoMarks.has('0,2')).toBe(true);
    expect(state.probeOwners.get('0,2')).toEqual(new Set(['1,2', '1,3']));

    const bothAnchors = state;
    state = transitions.transitionGame(state, puzzle, { type: 'tap', r: 1, c: 2, kind: 'single' }).state;

    expect(state.cells[0][2]).toBe('frag');
    expect(state.cells[1][2]).toBe('frag');
    expect(state.cells[1][3]).toBe('anchor');
    expect(state.underlay.get('0,2')).toBe('mark');
    expect(state.underlay.get('1,3')).toBe('mark');
    expect(state.autoMarks.has('0,2')).toBe(true);
    expect(state.probeOwners.get('0,2')).toEqual(new Set(['1,3']));
    expect(bothAnchors.probeOwners.get('0,2')).toEqual(new Set(['1,2', '1,3']));
    const view = transitions.projectGame(state, puzzle);
    expect(projectBoard(view.cells, puzzle, view.xMarks, view.violations, view.pulse, view.hitKey, view.autoMarks)[0][2].state)
      .toBe('auto');

    state = transitions.transitionGame(state, puzzle, { type: 'tap', r: 1, c: 3, kind: 'single' }).state;

    expect(state.cells[0][2]).toBe('mark');
    expect(state.cells[1][3]).toBe('mark');
    expect(state.underlay.has('0,2')).toBe(false);
    expect(state.autoMarks.has('0,2')).toBe(true);
    expect(state.probeOwners.has('0,2')).toBe(false);
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

describe('discovery reactions', () => {
  const puzzle = PUZZLES[0];
  const confirm = (state: transitions.GameState, [r, c]: [number, number]) =>
    transitions.transitionGame(state, puzzle, { type: 'tap', r, c, kind: 'double' });
  const isSolution = (r: number, c: number) => puzzle.solution.some(([sr, sc]) => sr === r && sc === c);
  const wrongCell = (): [number, number] => {
    for (let r = 0; r < puzzle.size; r += 1) for (let c = 0; c < puzzle.size; c += 1) if (!isSolution(r, c)) return [r, c];
    throw new Error('no wrong cell');
  };

  it('정답 확정마다 연속 횟수를 늘리고 단계별 반응을 남긴다', () => {
    let state = transitions.createGameState(puzzle.size);
    const tiers: number[] = [];
    for (const cell of puzzle.solution) {
      const result = confirm(state, cell);
      state = result.state;
      expect(state.reaction).toMatchObject({ kind: 'correct', key: `${cell[0]},${cell[1]}` });
      tiers.push(state.reaction!.tier);
    }
    expect(state.correctRun).toBe(puzzle.solution.length);
    expect(tiers).toEqual(puzzle.solution.map((_, i) => (i === puzzle.solution.length - 1 || i >= 3 ? 3 : i === 0 ? 1 : 2)));
  });

  it('오답 확정은 연속 횟수를 0으로 되돌리고 오답 반응을 남긴다', () => {
    const first = confirm(transitions.createGameState(puzzle.size), puzzle.solution[0]).state;
    const [r, c] = wrongCell();
    const wrong = confirm(transitions.createGameState(puzzle.size), [r, c]).state;
    expect(wrong.cells[r][c]).toBe('wrong');
    expect(wrong.correctRun).toBe(0);
    expect(wrong.reaction).toMatchObject({ kind: 'wrong', key: `${r},${c}` });

    const afterFirst = transitions.transitionGame(first, puzzle, { type: 'reset' }).state;
    expect(afterFirst.correctRun).toBe(0);
    expect(afterFirst.reaction).toBeNull();
  });

  it('반응마다 순번을 올리고 같은 입력이면 같은 반응을 낸다', () => {
    const initial = transitions.createGameState(puzzle.size);
    const once = confirm(initial, puzzle.solution[0]).state;
    const again = confirm(initial, puzzle.solution[0]).state;
    expect(again.reaction).toEqual(once.reaction);
    const second = confirm(once, puzzle.solution[1]).state;
    expect(second.reaction!.seq).toBe(once.reaction!.seq + 1);
  });

  it('마크 지우기 뒤 마지막 햄스터는 연속 횟수와 관계없이 가장 큰 반응을 낸다', () => {
    let state = transitions.createGameState(puzzle.size);
    for (const cell of puzzle.solution.slice(0, -1)) state = confirm(state, cell).state;
    state = transitions.transitionGame(state, puzzle, { type: 'resetMarks' }).state;
    expect(state.correctRun).toBe(0);
    expect(state.reaction).toBeNull();
    const last = confirm(state, puzzle.solution[puzzle.solution.length - 1]);
    expect(last.completed).toBe(true);
    expect(last.state.correctRun).toBe(1);
    expect(last.state.reaction).toMatchObject({ kind: 'correct', tier: 3 });
  });

  it('반응을 보드 투영에 노출한다', () => {
    const state = confirm(transitions.createGameState(puzzle.size), puzzle.solution[0]).state;
    expect(transitions.projectGame(state, puzzle).reaction).toEqual(state.reaction);
  });
});
