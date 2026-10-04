import { useRef, useState } from 'react';
import { getViolations, isCleared, isSolutionCell, type Violations } from './rules';
import type { CellState, Puzzle } from './puzzles';
import { nextState, spreadMarks, type TapKind } from './tap';

function blankBoard(size: number): CellState[][] {
  return Array.from({ length: size }, () => Array<CellState>(size).fill('empty'));
}

export interface PaintPatch {
  r: number;
  c: number;
  prev: CellState;
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
  paintCell: (r: number, c: number, toMark: boolean) => void;
  revertPaint: (patches: PaintPatch[]) => void;
  reset: () => void;
}

export function useHamSudoku(puzzle: Puzzle): HamSudoku {
  const [cells, setCells] = useState<CellState[][]>(() => blankBoard(puzzle.size));
  // 지연 탭(타이머 콜백)이 클릭 시점 스냅샷이 아닌 최신 판을 보도록 ref 미러를 둔다.
  // tapCell은 동기적으로 ref까지 갱신하므로 연타·더블클릭 경합에서도 덮어쓰기가 없다.
  const latest = useRef(cells);
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
    setCells(blank);
    setPulse(new Map());
    setHitKey(null);
  };

  // 같은 스트로크에서 되돌아가면 trail 이후 칠분을 칠하기 전 상태로 되돌린다.
  const revertPaint = (patches: PaintPatch[]) => {
    if (patches.length === 0) return;
    const next = latest.current.map((line) => [...line]);
    for (const p of patches) next[p.r][p.c] = p.prev;
    latest.current = next;
    setCells(next);
    setPulse(new Map());
    setHitKey(null);
  };

  // 드래그 칠하기: 전제 상태가 아니면 무시하므로 같은 칸 반복 진입에 안전하다.
  const paintCell = (r: number, c: number, toMark: boolean) => {
    const prev = latest.current;
    const want: CellState = toMark ? 'mark' : 'empty';
    const cur = prev[r][c];
    if (toMark ? cur !== 'empty' : cur !== 'mark') return;
    const next = prev.map((line) => [...line]);
    next[r][c] = want;
    latest.current = next;
    setCells(next);
    setPulse(new Map());
    setHitKey(null);
  };

  return { cells, violations, cleared, hamsterCount, pulse, hitKey, shake, tapCell, paintCell, revertPaint, reset };
}
