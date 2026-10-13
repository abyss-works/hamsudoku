import { countHamsters, getViolations, isCleared, isSolutionCell } from './rules';
import type { CellState, Puzzle } from './puzzles';
import { ownedProbeCells, resolveMark } from './probe';
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
  /** 칸별 임시 표시를 유지하는 앵커 집합. */
  probeOwners: Map<string, Set<string>>;
  /** 앵커·조각 아래에 저장된 일반 X마커. */
  underlay: Map<string, 'mark'>;
  /** 정답 전파로 잠긴 X마커. */
  autoMarks: Set<string>;
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
  return { cells: blankBoard(size), probeOwners: new Map(), underlay: new Map(), autoMarks: new Set(), stroke: null,
    probeActive: false, pulse: new Map(), hitKey: null, shake: 0 };
}

export function projectGame(state: GameState, puzzle: Puzzle) {
  return { cells: state.cells, xMarks: new Set(state.underlay.keys()), autoMarks: new Set(state.autoMarks),
    violations: getViolations(state.cells, puzzle.islands), cleared: isCleared(state.cells, puzzle.islands),
    hamsterCount: countHamsters(state.cells), probeSlots: PROBE_SLOTS - anchorCount(state.cells),
    pulse: state.pulse, hitKey: state.hitKey, shake: state.shake, probeActive: state.probeActive };
}

/** 입력의 Map·Set을 복제하여 전이 중 원본 상태를 변경하지 않는다. */
export function transitionGame(previous: GameState, puzzle: Puzzle, action: GameAction) {
  const state: GameState = { ...previous,
    probeOwners: new Map([...previous.probeOwners].map(([key, owners]) => [key, new Set(owners)])),
    underlay: new Map(previous.underlay),
    autoMarks: new Set(previous.autoMarks),
    stroke: previous.stroke ? { ...previous.stroke, visited: new Set(previous.stroke.visited) } : null };
  const sounds: GameSound[] = [];
  const commit = (cells: CellState[][], pulse: Map<string, number>, hitKey: string | null) => {
    state.cells = cells;
    state.pulse = pulse;
    state.hitKey = hitKey;
  };
  const addProbeOwner = (key: string, owner: string) => {
    const owners = state.probeOwners.get(key) ?? new Set<string>();
    owners.add(owner);
    state.probeOwners.set(key, owners);
  };
  const removeProbeOwner = (key: string, owner: string) => {
    const owners = state.probeOwners.get(key);
    if (!owners) return false;
    owners.delete(owner);
    if (owners.size > 0) return true;
    state.probeOwners.delete(key);
    return false;
  };
  // 앵커를 놓고 십자·주변·같은 섬에 조각을 살포한다. 기존 임시 표시에는 소유자를 추가한다.
  // 잠금·햄스터·오답마커는 바꾸지 않는다.
  // 덮인 X마커는 간직했다가 회수 때 되돌린다.
  const placeAnchor = (r: number, c: number) => {
    const prev = state.cells;
    if (anchorCount(prev) >= PROBE_SLOTS) return;
    const next = prev.map((line) => [...line]);
    const anchorKey = keyOf(r, c);
    if (prev[r][c] === 'mark') state.underlay.set(anchorKey, 'mark');
    next[r][c] = 'anchor';
    const delays = new Map<string, number>();
    for (const m of spreadMarks(prev.length, r, c, puzzle.islands)) {
      const cur = next[m.r][m.c];
      if (cur === 'empty' || cur === 'mark') {
        const key = keyOf(m.r, m.c);
        if (cur === 'mark') state.underlay.set(key, 'mark');
        next[m.r][m.c] = 'frag';
        addProbeOwner(key, anchorKey);
        delays.set(key, m.delayMs);
      } else if (cur === 'frag' || cur === 'anchor') {
        addProbeOwner(keyOf(m.r, m.c), anchorKey);
      }
    }
    commit(next, delays, null);
    sounds.push('mark');
  };

  // 앵커의 소유권을 회수한다. 마지막 소유자일 때만 덮인 X마커를 복원하고 조각을 지운다.
  const recallAnchor = (r: number, c: number) => {
    const prev = state.cells;
    const anchorKey = keyOf(r, c);
    const owned = ownedProbeCells(state.probeOwners, prev, anchorKey);
    const next = prev.map((line) => [...line]);
    if ((state.probeOwners.get(anchorKey)?.size ?? 0) > 0) {
      next[r][c] = 'frag';
    } else {
      next[r][c] = state.underlay.get(anchorKey) ?? 'empty';
      state.underlay.delete(anchorKey);
    }
    const delays = new Map<string, number>();
    const ordered = owned
      .map((key) => {
        const [fr, fc] = key.split(',').map(Number);
        return { key, dist: Math.max(Math.abs(fr - r), Math.abs(fc - c)) };
      })
      .sort((a, b) => b.dist - a.dist);
    ordered.forEach(({ key }, i) => {
      const [fr, fc] = key.split(',').map(Number);
      const remains = removeProbeOwner(key, anchorKey);
      if (!remains && prev[fr][fc] === 'frag') {
        next[fr][fc] = state.underlay.get(key) ?? 'empty';
        state.underlay.delete(key);
        delays.set(key, i * 60);
      }
    });
    commit(next, delays, null);
    sounds.push('erase');
  };

  const tapCell = (r: number, c: number, kind: TapKind) => {
    const prev = state.cells;
    const cur = prev[r][c];
    const key = keyOf(r, c);
    if (state.autoMarks.has(key)) return;
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
    if (result === 'hamster') {
      // 확정 칸이 덮인 조각이면 소유권을 끊어 회수 시 햄스터 칸으로 복원되지 않게 한다.
      if (after[r][c] === 'frag') {
        state.probeOwners.delete(key);
        state.underlay.delete(key);
      }
      // 앵커는 단일 회수 경로로 소유 조각까지 복원한 뒤 정답마커를 기록한다.
      const delays = new Map<string, number>();
      const spread = spreadMarks(after.length, r, c, puzzle.islands);
      for (const m of spread) {
        if (state.cells[m.r][m.c] === 'anchor') {
          recallAnchor(m.r, m.c);
          for (const [fragment, delay] of state.pulse) delays.set(fragment, delay);
        }
      }
      const next = state.cells.map((line) => [...line]);
      next[r][c] = result;
      for (const m of spread) {
        const target = next[m.r][m.c];
        if (target === 'empty' || target === 'mark' || target === 'frag') {
          state.autoMarks.add(keyOf(m.r, m.c));
          delays.set(keyOf(m.r, m.c), m.delayMs);
        }
      }
      commit(next, delays, keyOf(r, c));
      sounds.push('correct');
    } else {
      const next = after.map((line) => [...line]);
      next[r][c] = result;
      // 덮개를 소비하면 소유권을 끊는다.
      if (after[r][c] === 'frag') {
        state.probeOwners.delete(key);
        state.underlay.delete(key);
      }
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
    state.probeOwners.clear();
    state.underlay.clear();
    state.autoMarks.clear();
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
    state.probeOwners.clear();
    state.underlay.clear();
    state.stroke = null;
    state.pulse = new Map();
    state.hitKey = null;
  };

  // 칠하기 모드는 빈칸만 마크로, 지우기 모드는 X마커·앵커·덮인 조각을 바꾼다.
  // 덮인 조각은 X를 걷고 드러내고, 앵커는 조각까지 회수한다. 맨 조각은 손대지 않는다.
  const paintOne = (st: Stroke, r: number, c: number) => {
    const cur = state.cells[r][c];
    if (state.autoMarks.has(keyOf(r, c))) return;
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
    if (state.autoMarks.has(keyOf(r, c))) {
      state.stroke = null;
      return;
    }
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
