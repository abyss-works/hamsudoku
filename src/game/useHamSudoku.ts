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
}

// 진행 중 드래그. 지나가는 칸마다 빈칸과 마크만 서로 토글하고 다른 상태는 손대지 않는다.
interface Stroke {
  sr: number;
  sc: number;
  engaged: boolean;
  lastR: number;
  lastC: number;
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

  const toggleOne = (r: number, c: number) => {
    const cur = latest.current[r][c];
    if (cur !== 'empty' && cur !== 'mark') return;
    const next = latest.current.map((line) => [...line]);
    next[r][c] = cur === 'empty' ? 'mark' : 'empty';
    latest.current = next;
    setCells(next);
    setPulse(new Map());
    setHitKey(null);
  };

  const beginStroke = (r: number, c: number) => {
    strokeRef.current = { sr: r, sc: c, engaged: false, lastR: r, lastC: c };
  };

  // 누른 칸에서 다른 칸으로 처음 움직일 때 드래그로 확정되며 누른 칸부터 토글한다.
  // 같은 칸 연발 진입은 무시하고, 되돌아온 칸은 다시 토글한다.
  const strokeEnter = (r: number, c: number) => {
    const st = strokeRef.current;
    if (!st) return;
    if (st.lastR === r && st.lastC === c) return;
    st.lastR = r;
    st.lastC = c;
    if (!st.engaged) {
      st.engaged = true;
      toggleOne(st.sr, st.sc);
    }
    toggleOne(r, c);
  };

  const endStroke = () => {
    const engaged = strokeRef.current?.engaged ?? false;
    strokeRef.current = null;
    return engaged;
  };

  return { cells, violations, cleared, hamsterCount, pulse, hitKey, shake, tapCell, beginStroke, strokeEnter, endStroke, reset };
}
