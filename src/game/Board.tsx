import { Cell } from './Cell';
import { ClearDialog } from './ClearDialog';
import type { Violations } from './rules';
import type { CellState, Puzzle } from './puzzles';
import type { TapKind } from './tap';
import './hamster.css';

interface BoardProps {
  puzzle: Puzzle;
  cells: CellState[][];
  violations: Violations;
  cleared: boolean;
  onCell: (r: number, c: number, kind: TapKind) => void;
  onReset: () => void;
  onNextMap: () => void;
}

export function Board({ puzzle, cells, violations, cleared, onCell, onReset, onNextMap }: BoardProps) {
  return (
    <div className="board-wrap">
      <div
        className="board"
        role="grid"
        aria-label={puzzle.name}
        style={{ gridTemplateColumns: `repeat(${puzzle.size}, 1fr)` }}
      >
        {cells.map((line, r) =>
          line.map((state, c) => {
            const conflicted =
              violations.rows.has(r) ||
              violations.cols.has(c) ||
              violations.islands.has(puzzle.islands[r][c]) ||
              violations.touch.has(`${r},${c}`);
            return (
              <Cell
                key={`${r}-${c}`}
                state={state}
                islandId={puzzle.islands[r][c]}
                conflicted={conflicted}
                onTap={(kind) => onCell(r, c, kind)}
              />
            );
          }),
        )}
      </div>
      {cleared && <ClearDialog onReset={onReset} onNextMap={onNextMap} />}
    </div>
  );
}
