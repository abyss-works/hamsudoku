import { useEffect, useRef } from 'react';
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
  pulse?: ReadonlyMap<string, number>;
  hitKey?: string | null;
  shake?: number;
  onCell: (r: number, c: number, kind: TapKind) => void;
  onReset: () => void;
  onNextMap: () => void;
}

export function Board({
  puzzle,
  cells,
  violations,
  cleared,
  pulse = new Map(),
  hitKey = null,
  shake = 0,
  onCell,
  onReset,
  onNextMap,
}: BoardProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = wrapRef.current;
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }, [shake]);

  return (
    <div className="board-wrap" ref={wrapRef}>
      <div
        className="board"
        role="grid"
        aria-label={puzzle.name}
        style={{ gridTemplateColumns: `repeat(${puzzle.size}, 1fr)` }}
      >
        {cells.map((line, r) =>
          line.map((state, c) => {
            const key = `${r},${c}`;
            const conflicted =
              violations.rows.has(r) ||
              violations.cols.has(c) ||
              violations.islands.has(puzzle.islands[r][c]) ||
              violations.touch.has(key);
            return (
              <Cell
                key={`${r}-${c}`}
                state={state}
                islandId={puzzle.islands[r][c]}
                conflicted={conflicted}
                hit={hitKey === key}
                pulseDelay={pulse.get(key)}
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
