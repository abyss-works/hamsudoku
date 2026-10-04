import { Cell } from './Cell';
import type { Violations } from './rules';
import type { CellState, Puzzle } from './puzzles';

interface BoardProps {
  puzzle: Puzzle;
  cells: CellState[][];
  violations: Violations;
  cleared: boolean;
  onCell: (r: number, c: number) => void;
  onReset: () => void;
  onNextMap: () => void;
}

export function Board({ puzzle, cells, violations, cleared, onCell, onReset, onNextMap }: BoardProps) {
  return (
    <div className="board-wrap">
      <div className="board" role="grid" aria-label={puzzle.name}>
        {cells.map((line, r) =>
          line.map((state, c) => {
            const conflicted =
              violations.rows.has(r) || violations.cols.has(c) || violations.islands.has(puzzle.islands[r][c]);
            return (
              <Cell
                key={`${r}-${c}`}
                state={state}
                islandId={puzzle.islands[r][c]}
                conflicted={conflicted}
                onTap={() => onCell(r, c)}
              />
            );
          }),
        )}
      </div>
      {cleared && (
        <div className="clear-overlay" role="dialog" aria-label="클리어">
          <p className="clear-title">🎉 햄스터 5마리를 다 찾았다!</p>
          <div className="clear-actions">
            <button type="button" onClick={onReset}>
              다시하기
            </button>
            <button type="button" onClick={onNextMap}>
              다음 맵
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
