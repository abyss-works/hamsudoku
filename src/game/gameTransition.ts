import { countHamsters, getViolations, isCleared, isSolutionCell } from './rules';
import type { CellState, Puzzle } from './puzzles';
import { ownedFrags, resolveMark } from './probe';
import { nextState, spreadMarks, type TapKind } from './tap';

function blankBoard(size: number): CellState[][] {
  return Array.from({ length: size }, () => Array<CellState>(size).fill('empty'));
}

function keyOf(r: number, c: number): string {
  return `${r},${c}`;
}

/** 한 판에 동시에 놓을 수 있는 임시 정답(앵커) 수. 지우면 충전된다. */
export const PROBE_SLOTS = 3;

// 진행 중 드래그. 누른 칸이 마크·앵커면 지우기, 아니면 칠하기 모드다.
// 처음 올라탄 칸만 모드대로 바꾸고, 한 번 지나간 칸은 다시 건드리지 않는다.
// 칠하고 지울 때마다 속도에 맞춰 겹쳐 난다.
interface Stroke {
  sr: number;
  sc: number;
  toMark: boolean;
  engaged: boolean;
  visited: Set<string>;
}

function anchorCount(cells: CellState[][]): number {
  let n = 0;
  for (const line of cells) for (const cell of line) if (cell === 'anchor') n += 1;
  return n;
}

export interface GameState {
  cells: CellState[][];
  links: Map<string, string>;
  underlay: Map<string, 'mark'>;
  stroke: Stroke | null;
  probeActive: boolean;
  pulse: ReadonlyMap<string, number>;
  hitKey: string | null;
  shake: number;
}

export type GameSound = 'mark' | 'erase' | 'correct' | 'wrong' | 'reset';
export type GameAction =
  | { type: 'tap'; r: number; c: number; kind: TapKind }
  | { type: 'begin' | 'enter'; r: number; c: number }
  | { type: 'probe'; on: boolean }
  | { type: 'end' | 'reset' | 'resetMarks' };

export function createGameState(size: number): GameState {
  return { cells: blankBoard(size), links: new Map(), underlay: new Map(), stroke: null,
    probeActive: false, pulse: new Map(), hitKey: null, shake: 0 };
}

export function projectGame(state: GameState, puzzle: Puzzle) {
  return { cells: state.cells, xMarks: new Set(state.underlay.keys()),
    violations: getViolations(state.cells, puzzle.islands), cleared: isCleared(state.cells, puzzle.islands),
    hamsterCount: countHamsters(state.cells), probeSlots: PROBE_SLOTS - anchorCount(state.cells),
    pulse: state.pulse, hitKey: state.hitKey, shake: state.shake, probeActive: state.probeActive };
}

/** 입력의 Map·Set을 복제하여 전이 중 원본 상태를 변경하지 않는다. */
export function transitionGame(previous: GameState, puzzle: Puzzle, action: GameAction) {
  const state: GameState = { ...previous, links: new Map(previous.links), underlay: new Map(previous.underlay),
    stroke: previous.stroke ? { ...previous.stroke, visited: new Set(previous.stroke.visited) } : null };
  const sounds: GameSound[] = [];
  const commit = (cells: CellState[][], pulse: Map<string, number>, hitKey: string | null) => {
    state.cells = cells;
    state.pulse = pulse;
    state.hitKey = hitKey;
  };
  // 앵커를 놓고 십자·주변·같은 섬에 조각을 살포한다. 빈칸·회색X·덮인 조각만 바뀌고
  // 잠금·햄스터·남의 조각은 통과한다.
  // 덮인 X마커는 간직했다가 회수 때 되돌린다.
  const placeAnchor = (r: number, c: number) => {
    const prev = state.cells;
    if (anchorCount(prev) >= PROBE_SLOTS) return;
    const next = prev.map((line) => [...line]);
    if (prev[r][c] === 'mark') state.underlay.set(keyOf(r, c), 'mark');
    if (prev[r][c] === 'frag') {
      // 덮개를 벗기고 앵커가 차지한다.
      state.links.delete(keyOf(r, c));
      state.underlay.delete(keyOf(r, c));
    }
    next[r][c] = 'anchor';
    const delays = new Map<string, number>();
    for (const m of spreadMarks(prev.length, r, c, puzzle.islands)) {
      const cur = next[m.r][m.c];
      if (cur === 'empty' || cur === 'mark') {
        if (cur === 'mark') state.underlay.set(keyOf(m.r, m.c), 'mark');
        next[m.r][m.c] = 'frag';
        state.links.set(keyOf(m.r, m.c), keyOf(r, c));
        delays.set(keyOf(m.r, m.c), m.delayMs);
      }
    }
    commit(next, delays, null);
    sounds.push('mark');
  };

  // 앵커와 자기 조각을 거둔다. 덮인 X마커는 되돌리고 먼 조각부터 역순으로 사라진다.
  const recallAnchor = (r: number, c: number) => {
    const prev = state.cells;
    const owned = ownedFrags(state.links, prev, keyOf(r, c));
    const next = prev.map((line) => [...line]);
    next[r][c] = state.underlay.get(keyOf(r, c)) ?? 'empty';
    state.underlay.delete(keyOf(r, c));
    const delays = new Map<string, number>();
    const ordered = owned
      .map((key) => {
        const [fr, fc] = key.split(',').map(Number);
        return { key, dist: Math.max(Math.abs(fr - r), Math.abs(fc - c)) };
      })
      .sort((a, b) => b.dist - a.dist);
    ordered.forEach(({ key }, i) => {
      const [fr, fc] = key.split(',').map(Number);
      next[fr][fc] = state.underlay.get(key) ?? 'empty';
      state.underlay.delete(key);
      state.links.delete(key);
      delays.set(key, i * 60);
    });
    commit(next, delays, null);
    sounds.push('erase');
  };

  const tapCell = (r: number, c: number, kind: TapKind) => {
    const prev = state.cells;
    const cur = prev[r][c];
    const key = keyOf(r, c);
    // 덮인 조각은 X로 본다. 상태는 조각 그대로 두고 렌더만 X가 이긴다.
    const covered = cur === 'frag' && state.underlay.has(key);
    if (state.probeActive && kind === 'single') {
      // 아이템 켜짐: 싱글톡은 놓기·회수만 하고 판정은 하지 않는다.
      // 더블톡은 전역 확정으로 아래 일반 경로를 탄다.
      if (cur === 'empty' || cur === 'mark' || covered) placeAnchor(r, c);
      else if (cur === 'anchor') recallAnchor(r, c);
      return;
    }
    if (cur === 'anchor' && kind === 'single') {
      recallAnchor(r, c);
      return;
    }
    if (cur === 'frag' && kind === 'single') {
      if (covered) {
        // X를 걷고 조각을 드러낸다.
        state.underlay.delete(key);
        sounds.push('erase');
      } else {
        // X를 올린다. 조각은 살린다.
        state.underlay.set(key, 'mark');
        sounds.push('mark');
      }
      commit(prev.map((line) => [...line]), new Map(), null);
      return;
    }
    if (cur === 'anchor' && kind === 'double') {
      // 확정은 앵커를 먼저 지우고 빈칸에서 시도한다. 조각이 남지 않는다.
      recallAnchor(r, c);
    }
    const after = state.cells;
    // 덮인 조각은 X로 보고 확정한다.
    const base = resolveMark(after[r][c], state.underlay.has(key));
    const result = nextState(base, kind, isSolutionCell(puzzle, r, c));
    if (result === base) return;
    const next = after.map((line) => [...line]);
    next[r][c] = result;
    // 덮개를 소비하면 소유권을 끊는다.
    if (after[r][c] === 'frag') {
      state.links.delete(key);
      state.underlay.delete(key);
    }
    if (result === 'hamster') {
      const delays = new Map<string, number>();
      // 빈 타일·회색X만 정답마커로 바꾼다. 남의 조각·앵커는 건드리지 않는다.
      for (const m of spreadMarks(after.length, r, c, puzzle.islands)) {
        const target = next[m.r][m.c];
        if (target === 'empty' || target === 'mark') {
          next[m.r][m.c] = 'auto';
          delays.set(keyOf(m.r, m.c), m.delayMs);
        }
      }
      commit(next, delays, keyOf(r, c));
      sounds.push('correct');
    } else {
      commit(next, new Map(), null);
      if (result === 'wrong' && kind === 'double') {
        state.shake += 1;
        sounds.push('wrong');
      } else if (result === 'empty') {
        sounds.push('erase');
      } else if (result === 'mark') {
        sounds.push('mark');
      }
    }
  };

  const reset = () => {
    const blank = blankBoard(puzzle.size);
    state.cells = blank;
    state.links.clear();
    state.underlay.clear();
    state.stroke = null;
    state.pulse = new Map();
    state.hitKey = null;
    sounds.push('reset');
  };

  // X마커·앵커·조각을 전부 빈칸으로 되돌린다. 햄스터·정답·오답마커는 그대로 둔다.
  const resetMarks = () => {
    const next = state.cells.map((line) =>
      line.map((cell) => (cell === 'mark' || cell === 'anchor' || cell === 'frag' ? 'empty' : cell)),
    );
    state.cells = next;
    state.links.clear();
    state.underlay.clear();
    state.stroke = null;
    state.pulse = new Map();
    state.hitKey = null;
  };

  // 칠하기 모드는 빈칸만 마크로, 지우기 모드는 X마커·앵커·덮인 조각을 바꾼다.
  // 덮인 조각은 X를 걷고 드러내고, 앵커는 조각까지 회수한다. 맨 조각은 손대지 않는다.
  const paintOne = (st: Stroke, r: number, c: number) => {
    const cur = state.cells[r][c];
    if (st.toMark) {
      if (cur !== 'empty') return;
      const next = state.cells.map((line) => [...line]);
      next[r][c] = 'mark';
      commit(next, new Map(), null);
      sounds.push('mark');
      return;
    }
    if (cur === 'mark') {
      const next = state.cells.map((line) => [...line]);
      next[r][c] = 'empty';
      commit(next, new Map(), null);
      sounds.push('erase');
      return;
    }
    if (cur === 'frag' && state.underlay.has(keyOf(r, c))) {
      state.underlay.delete(keyOf(r, c));
      commit(state.cells.map((line) => [...line]), new Map(), null);
      sounds.push('erase');
      return;
    }
    if (cur === 'anchor') recallAnchor(r, c);
  };

  const beginStroke = (r: number, c: number) => {
    // 아이템 켜짐: 스트로크는 무시하고 톡으로만 놓는다.
    if (state.probeActive) {
      state.stroke = null;
      return;
    }
    const cur = state.cells[r][c];
    // 덮인 조각은 X로 본다.
    const pressed = resolveMark(cur, state.underlay.has(keyOf(r, c)));
    const toMark = pressed !== 'mark' && pressed !== 'anchor';
    state.stroke = { sr: r, sc: c, toMark, engaged: false, visited: new Set([`${r},${c}`]) };
  };

  // 누른 칸에서 다른 칸으로 처음 움직일 때 드래그로 확정되며 누른 칸부터 모드대로 바꾼다.
  // 이미 지나간 칸(누른 칸 포함)에 다시 들어오면 아무것도 하지 않는다.
  const strokeEnter = (r: number, c: number) => {
    const st = state.stroke;
    if (!st) return;
    const key = `${r},${c}`;
    if (st.visited.has(key)) return;
    st.visited.add(key);
    if (!st.engaged) {
      st.engaged = true;
      paintOne(st, st.sr, st.sc);
    }
    paintOne(st, r, c);
  };

  const endStroke = () => {
    const engaged = state.stroke?.engaged ?? false;
    state.stroke = null;
    return engaged;
  };

  let engaged = false;
  switch (action.type) {
    case 'tap': tapCell(action.r, action.c, action.kind); break;
    case 'begin': beginStroke(action.r, action.c); break;
    case 'enter': strokeEnter(action.r, action.c); break;
    case 'end': engaged = endStroke(); break;
    case 'probe': state.probeActive = action.on; break;
    case 'reset': reset(); break;
    case 'resetMarks': resetMarks(); break;
  }
  const completed = !isCleared(previous.cells, puzzle.islands) && isCleared(state.cells, puzzle.islands);
  return { state, sounds, engaged, completed };
}
