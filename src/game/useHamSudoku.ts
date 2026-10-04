import { useRef, useState } from 'react';
import { getViolations, isCleared, isSolutionCell, type Violations } from './rules';
import type { CellState, Puzzle } from './puzzles';
import { nextState, spreadMarks, type TapKind } from './tap';

function blankBoard(size: number): CellState[][] {
  return Array.from({ length: size }, () => Array<CellState>(size).fill('empty'));
}

export interface HamSudoku {
  cells: CellState[][];
  violations: Violations;
  cleared: boolean;
  hamsterCount: number;
  pulse: ReadonlyMap<string, number>;
  hitKey: string | null;
  shake: number;
  tapCell: (r: number, c: number, kind: TapKind) => void;
  beginStroke: (r: number, c: number) => void;
  strokeEnter: (r: number, c: number) => void;
  endStroke: () => boolean;
  reset: () => void;
}

// 한 스트로크 동안 바뀐 칸 목록. 들어간 칸이 이미 바뀌었으면,
// 출발한 칸(바로 전에 있던 칸)이 바뀌었으면 출발칸을 되돌린다. 건너뛴 칸은 손대지 않는다.
interface Stroke {
  sr: number;
  sc: number;
  toMark: boolean;
  engaged: boolean;
  lastR: number | null;
  lastC: number | null;
  trail: { r: number; c: number; prev: CellState }[];
}

export function useHamSudoku(puzzle: Puzzle): HamSudoku {
  const [cells, setCells] = useState<CellState[][]>(() => blankBoard(puzzle.size));
  // 지연 탭(타이머 콜백)이 클릭 시점 스냅샷이 아닌 최신 판을 보도록 ref 미러를 둔다.
  // tapCell은 동기적으로 ref까지 갱신하므로 연타·더블클릭 경합에서도 덮어쓰기가 없다.
  const latest = useRef(cells);
  // 진행 중 스트로크. 최신 판은 latest ref로만 읽어서 지연 이벤트 경합을 피한다.
  const strokeRef = useRef<Stroke | null>(null);
  const [pulse, setPulse] = useState<ReadonlyMap<string, number>>(new Map());
  const [hitKey, setHitKey] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  const violations = getViolations(cells, puzzle.islands);
  const cleared = isCleared(cells, puzzle.islands);
  let hamsterCount = 0;
  for (const line of cells) for (const cell of line) if (cell === 'hamster') hamsterCount += 1;

  const tapCell = (r: number, c: number, kind: TapKind) => {
    const prev = latest.current;
    const result = nextState(prev[r][c], kind, isSolutionCell(puzzle, r, c));
    if (result === prev[r][c]) return;
    const next = prev.map((line) => [...line]);
    next[r][c] = result;
    if (result === 'hamster') {
      const delays = new Map<string, number>();
      for (const m of spreadMarks(prev.length, r, c)) {
        if (next[m.r][m.c] === 'empty') {
          next[m.r][m.c] = 'auto';
          delays.set(`${m.r},${m.c}`, m.delayMs);
        }
      }
      setPulse(delays);
      setHitKey(`${r},${c}`);
    } else {
      setPulse(new Map());
      setHitKey(null);
      if (result === 'wrong' && kind === 'double') setShake((n) => n + 1);
    }
    latest.current = next;
    setCells(next);
  };

  const reset = () => {
    const blank = blankBoard(puzzle.size);
    latest.current = blank;
    strokeRef.current = null;
    setCells(blank);
    setPulse(new Map());
    setHitKey(null);
  };

  const paintOne = (st: Stroke, r: number, c: number) => {
    const cur = latest.current[r][c];
    if (st.toMark ? cur !== 'empty' : cur !== 'mark') return;
    const next = latest.current.map((line) => [...line]);
    next[r][c] = st.toMark ? 'mark' : 'empty';
    st.trail.push({ r, c, prev: cur });
    latest.current = next;
    setCells(next);
    setPulse(new Map());
    setHitKey(null);
  };

  const revertOne = (st: Stroke, r: number, c: number) => {
    const at = st.trail.findIndex((t) => t.r === r && t.c === c);
    if (at < 0) return;
    const [t] = st.trail.splice(at, 1);
    const next = latest.current.map((line) => [...line]);
    next[t.r][t.c] = t.prev;
    latest.current = next;
    setCells(next);
    setPulse(new Map());
    setHitKey(null);
  };

  const inTrail = (st: Stroke, r: number, c: number) => st.trail.some((t) => t.r === r && t.c === c);

  const beginStroke = (r: number, c: number) => {
    const cur = latest.current[r][c];
    if (cur !== 'empty' && cur !== 'mark') {
      strokeRef.current = null;
      return;
    }
    strokeRef.current = { sr: r, sc: c, toMark: cur === 'empty', engaged: false, lastR: null, lastC: null, trail: [] };
  };

  const strokeEnter = (r: number, c: number) => {
    const st = strokeRef.current;
    if (!st) return;
    if (st.lastR === r && st.lastC === c) return;
    const depR = st.lastR;
    const depC = st.lastC;
    st.lastR = r;
    st.lastC = c;
    if (!st.engaged) {
      st.engaged = true;
      paintOne(st, st.sr, st.sc);
      if (r === st.sr && c === st.sc) return;
    }
    if (inTrail(st, r, c)) {
      if (depR !== null && depC !== null && inTrail(st, depR, depC)) revertOne(st, depR, depC);
      else revertOne(st, r, c);
    } else {
      paintOne(st, r, c);
    }
  };

  const endStroke = () => {
    const engaged = strokeRef.current?.engaged ?? false;
    strokeRef.current = null;
    return engaged;
  };

  return { cells, violations, cleared, hamsterCount, pulse, hitKey, shake, tapCell, beginStroke, strokeEnter, endStroke, reset };
}
