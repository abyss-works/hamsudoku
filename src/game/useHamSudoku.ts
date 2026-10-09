import { useRef, useState } from 'react';
import { countHamsters, getViolations, isCleared, isSolutionCell, type Violations } from './rules';
import type { CellState, Puzzle } from './puzzles';
import { playSfx } from './sound';
import { nextState, spreadMarks, type TapKind } from './tap';

function blankBoard(size: number): CellState[][] {
  return Array.from({ length: size }, () => Array<CellState>(size).fill('empty'));
}

function keyOf(r: number, c: number): string {
  return `${r},${c}`;
}

/** 한 판에 동시에 놓을 수 있는 임시 정답(앵커) 수. 지우면 충전된다. */
export const PROBE_SLOTS = 3;

export interface HamSudoku {
  cells: CellState[][];
  violations: Violations;
  cleared: boolean;
  hamsterCount: number;
  pulse: ReadonlyMap<string, number>;
  hitKey: string | null;
  shake: number;
  /** 임시 정답 아이템 켜짐. 켠 동안 싱글·더블톡은 앵커 놓기·회수만 한다. */
  probeActive: boolean;
  setProbeActive: (on: boolean) => void;
  /** 남은 앵커 슬롯. */
  probeSlots: number;
  tapCell: (r: number, c: number, kind: TapKind) => void;
  beginStroke: (r: number, c: number) => void;
  strokeEnter: (r: number, c: number) => void;
  endStroke: () => boolean;
  reset: () => void;
  /** X마커·앵커·조각을 전부 빈칸으로 되돌린다. 햄스터·정답·오답마커는 그대로 둔다. */
  resetMarks: () => void;
}

// 진행 중 드래그. 누른 칸이 마크·앵커면 지우기, 아니면 칠하기 모드다.
// 처음 올라탄 칸만 모드대로 바꾸고, 한 번 지나간 칸은 다시 건드리지 않는다.
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

export function useHamSudoku(puzzle: Puzzle): HamSudoku {
  const [cells, setCells] = useState<CellState[][]>(() => blankBoard(puzzle.size));
  const [probeActive, setProbeActiveState] = useState(false);
  const probeRef = useRef(false);
  const setProbeActive = (on: boolean) => {
    probeRef.current = on;
    setProbeActiveState(on);
  };
  // 지연 탭(타이머 콜백)이 클릭 시점 스냅샷이 아닌 최신 판을 보도록 ref 미러를 둔다.
  // tapCell은 동기적으로 ref까지 갱신하므로 연타·더블클릭 경합에서도 덮어쓰기가 없다.
  const latest = useRef(cells);
  // 조각→앵커 소유자. 앵커를 지울 때 자기 조각만 회수한다.
  // 조각이 전파로 정답마커가 되면 항목이 stale해지며 reset에서 비운다.
  const links = useRef(new Map<string, string>());
  // 조각·앵커에 덮인 X마커. 회수 때 되돌린다. 전파로 정답마커가 되면 함께 버린다.
  const underlay = useRef(new Map<string, 'mark'>());
  // 진행 중 스트로크. 최신 판은 latest ref로만 읽어서 지연 이벤트 경합을 피한다.
  const strokeRef = useRef<Stroke | null>(null);
  const [pulse, setPulse] = useState<ReadonlyMap<string, number>>(new Map());
  const [hitKey, setHitKey] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  const violations = getViolations(cells, puzzle.islands);
  const cleared = isCleared(cells, puzzle.islands);
  const hamsterCount = countHamsters(cells);
  const probeSlots = PROBE_SLOTS - anchorCount(cells);

  const commit = (next: CellState[][], delays: Map<string, number>, hit: string | null) => {
    latest.current = next;
    setCells(next);
    setPulse(delays);
    setHitKey(hit);
  };

  // 앵커를 놓고 십자·주변에 조각을 살포한다. 빈칸·회색X만 바뀌고 잠금·햄스터·남의 조각은 통과한다.
  // 덮인 X마커는 간직했다가 회수 때 되돌린다.
  const placeAnchor = (r: number, c: number) => {
    const prev = latest.current;
    if (anchorCount(prev) >= PROBE_SLOTS) return;
    const next = prev.map((line) => [...line]);
    if (prev[r][c] === 'mark') underlay.current.set(keyOf(r, c), 'mark');
    next[r][c] = 'anchor';
    const delays = new Map<string, number>();
    for (const m of spreadMarks(prev.length, r, c)) {
      const cur = next[m.r][m.c];
      if (cur === 'empty' || cur === 'mark') {
        if (cur === 'mark') underlay.current.set(keyOf(m.r, m.c), 'mark');
        next[m.r][m.c] = 'frag';
        links.current.set(keyOf(m.r, m.c), keyOf(r, c));
        delays.set(keyOf(m.r, m.c), m.delayMs);
      }
    }
    commit(next, delays, null);
    playSfx('mark');
  };

  // 앵커와 자기 조각을 거둔다. 덮인 X마커는 되돌리고 먼 조각부터 역순으로 사라진다.
  const recallAnchor = (r: number, c: number) => {
    const prev = latest.current;
    const owner = keyOf(r, c);
    const owned: string[] = [];
    for (const [frag, anchor] of links.current) {
      if (anchor === owner) {
        const [fr, fc] = frag.split(',').map(Number);
        if (prev[fr]?.[fc] === 'frag') owned.push(frag);
      }
    }
    const next = prev.map((line) => [...line]);
    next[r][c] = underlay.current.get(owner) ?? 'empty';
    underlay.current.delete(owner);
    const delays = new Map<string, number>();
    const ordered = owned
      .map((key) => {
        const [fr, fc] = key.split(',').map(Number);
        return { key, dist: Math.max(Math.abs(fr - r), Math.abs(fc - c)) };
      })
      .sort((a, b) => b.dist - a.dist);
    ordered.forEach(({ key }, i) => {
      const [fr, fc] = key.split(',').map(Number);
      next[fr][fc] = underlay.current.get(key) ?? 'empty';
      underlay.current.delete(key);
      links.current.delete(key);
      delays.set(key, i * 60);
    });
    commit(next, delays, null);
    playSfx('erase');
  };

  const tapCell = (r: number, c: number, kind: TapKind) => {
    const prev = latest.current;
    const cur = prev[r][c];
    if (probeRef.current) {
      // 아이템 켜짐: 놓기·회수만 하고 판정은 하지 않는다. 더블도 놓기로만 본다.
      if (cur === 'empty' || cur === 'mark') placeAnchor(r, c);
      else if (cur === 'anchor') recallAnchor(r, c);
      return;
    }
    if (cur === 'frag') return;
    if (cur === 'anchor' && kind === 'single') {
      recallAnchor(r, c);
      return;
    }
    if (cur === 'anchor' && kind === 'double') {
      // 확정은 앵커를 먼저 지우고 빈칸에서 시도한다. 조각이 남지 않는다.
      recallAnchor(r, c);
    }
    const after = latest.current;
    const result = nextState(after[r][c], kind, isSolutionCell(puzzle, r, c));
    if (result === after[r][c]) return;
    const next = after.map((line) => [...line]);
    next[r][c] = result;
    if (result === 'hamster') {
      const delays = new Map<string, number>();
      // 빈 타일·회색X·조각을 정답마커로 바꾼다. 남의 앵커는 건드리지 않는다.
      // 조각에 덮인 X마커는 함께 버린다.
      for (const m of spreadMarks(after.length, r, c)) {
        const target = next[m.r][m.c];
        if (target === 'empty' || target === 'mark' || target === 'frag') {
          next[m.r][m.c] = 'auto';
          links.current.delete(keyOf(m.r, m.c));
          underlay.current.delete(keyOf(m.r, m.c));
          delays.set(keyOf(m.r, m.c), m.delayMs);
        }
      }
      commit(next, delays, keyOf(r, c));
      playSfx('good');
    } else {
      commit(next, new Map(), null);
      if (result === 'wrong' && kind === 'double') {
        setShake((n) => n + 1);
        playSfx('bad');
      } else if (result === 'empty') {
        playSfx('erase');
      } else if (result === 'mark') {
        playSfx('mark');
      }
    }
  };

  const reset = () => {
    const blank = blankBoard(puzzle.size);
    latest.current = blank;
    links.current.clear();
    underlay.current.clear();
    strokeRef.current = null;
    setCells(blank);
    setPulse(new Map());
    setHitKey(null);
  };

  // X마커·앵커·조각을 전부 빈칸으로 되돌린다. 햄스터·정답·오답마커는 그대로 둔다.
  const resetMarks = () => {
    const next = latest.current.map((line) =>
      line.map((cell) => (cell === 'mark' || cell === 'anchor' || cell === 'frag' ? 'empty' : cell)),
    );
    latest.current = next;
    links.current.clear();
    underlay.current.clear();
    strokeRef.current = null;
    setCells(next);
    setPulse(new Map());
    setHitKey(null);
  };

  // 칠하기 모드는 빈칸만 마크로, 지우기 모드는 마크·앵커만 바꾼다(앵커는 조각까지 회수).
  // 조각은 직접 지울 수 없고 다른 상태는 손대지 않는다.
  const paintOne = (st: Stroke, r: number, c: number) => {
    const cur = latest.current[r][c];
    if (st.toMark) {
      if (cur !== 'empty') return;
      const next = latest.current.map((line) => [...line]);
      next[r][c] = 'mark';
      commit(next, new Map(), null);
      return;
    }
    if (cur === 'mark') {
      const next = latest.current.map((line) => [...line]);
      next[r][c] = 'empty';
      commit(next, new Map(), null);
      return;
    }
    if (cur === 'anchor') recallAnchor(r, c);
  };

  const beginStroke = (r: number, c: number) => {
    // 아이템 켜짐: 스트로크는 무시하고 톡으로만 놓는다.
    if (probeRef.current) {
      strokeRef.current = null;
      return;
    }
    const cur = latest.current[r][c];
    const toMark = cur !== 'mark' && cur !== 'anchor';
    strokeRef.current = { sr: r, sc: c, toMark, engaged: false, visited: new Set([`${r},${c}`]) };
  };

  // 누른 칸에서 다른 칸으로 처음 움직일 때 드래그로 확정되며 누른 칸부터 모드대로 바꾼다.
  // 이미 지나간 칸(누른 칸 포함)에 다시 들어오면 아무것도 하지 않는다.
  const strokeEnter = (r: number, c: number) => {
    const st = strokeRef.current;
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
    const engaged = strokeRef.current?.engaged ?? false;
    strokeRef.current = null;
    return engaged;
  };

  return { cells, violations, cleared, hamsterCount, pulse, hitKey, shake, probeActive, setProbeActive, probeSlots, tapCell, beginStroke, strokeEnter, endStroke, reset, resetMarks };
}
