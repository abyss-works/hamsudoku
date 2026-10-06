import { useRef, useState } from 'react';
import { countHamsters, getViolations, isCleared, isSolutionCell, type Violations } from './rules';
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
  clearMarks: () => void;
}

// 진행 중 드래그. 누른 칸이 마크면 지우기, 아니면 칠하기 모드다.
// 처음 올라탄 칸만 모드대로 바꾸고, 한 번 지나간 칸은 다시 건드리지 않는다.
interface Stroke {
  sr: number;
  sc: number;
  toMark: boolean;
  engaged: boolean;
  visited: Set<string>;
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
  const hamsterCount = countHamsters(cells);

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

  // 마크만 전부 빈칸으로 되돌린다. 햄스터·자동·오답은 그대로 둔다.
  const clearMarks = () => {
    const next = latest.current.map((line) => line.map((cell) => (cell === 'mark' ? 'empty' : cell)));
    latest.current = next;
    strokeRef.current = null;
    setCells(next);
    setPulse(new Map());
    setHitKey(null);
  };

  // 칠하기 모드는 빈칸만 마크로, 지우기 모드는 마크만 빈칸으로 바꾼다. 다른 상태는 손대지 않는다.
  const paintOne = (st: Stroke, r: number, c: number) => {
    const cur = latest.current[r][c];
    if (st.toMark ? cur !== 'empty' : cur !== 'mark') return;
    const next = latest.current.map((line) => [...line]);
    next[r][c] = st.toMark ? 'mark' : 'empty';
    latest.current = next;
    setCells(next);
    setPulse(new Map());
    setHitKey(null);
  };

  const beginStroke = (r: number, c: number) => {
    const toMark = latest.current[r][c] !== 'mark';
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

  return { cells, violations, cleared, hamsterCount, pulse, hitKey, shake, tapCell, beginStroke, strokeEnter, endStroke, reset, clearMarks };
}
