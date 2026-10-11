import { resolveMark } from './probe';
import { cellConflicted, type Violations } from './rules';
import type { CellState, Puzzle } from './puzzles';

const CELL_STATE_LABEL: Record<CellState, string> = {
  empty: '빈칸',
  mark: 'X 표시',
  anchor: '임시 정답 표시',
  frag: '물음표 표시',
  auto: '자동 표시',
  hamster: '햄스터',
  wrong: '틀린 칸',
};

export function cellAriaLabel(state: CellState, islandId: number): string {
  return `${CELL_STATE_LABEL[state]} (색 ${islandId + 1})`;
}

export function projectBoard(
  cells: CellState[][],
  puzzle: Puzzle,
  xMarks: ReadonlySet<string>,
  violations: Violations,
  pulse: ReadonlyMap<string, number>,
  hitKey: string | null,
) {
  return cells.map((line, row) =>
    line.map((rawState, col) => {
      const key = `${row},${col}`;
      const state = resolveMark(rawState, xMarks.has(key));
      const islandId = puzzle.islands[row][col];
      const conflicted = cellConflicted(violations, puzzle.islands, row, col);
      const hit = hitKey === key;
      const pulseDelay = pulse.get(key);
      const pulseDelaySec = (pulseDelay ?? 0) / 1000;
      const ariaLabel = cellAriaLabel(state, islandId);
      return {
        row,
        col,
        state,
        islandId,
        conflicted,
        hit,
        pulseDelay,
        pulseDelaySec,
        ariaLabel,
      };
    }),
  );
}
