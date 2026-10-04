import type { CSSProperties } from 'react';
import { Cell, HamsterFace } from './Cell';
import type { Violations } from './rules';
import type { CellState, Puzzle } from './puzzles';
import './hamster.css';

const CONFETTI_COLORS = ['#e5484d', '#f5a524', '#46a758', '#3e63dd', '#8e4ec6', '#f76b15'];
const CONFETTI: { x: string; c: string; d: string }[] = Array.from({ length: 24 }, (_, i) => ({
  x: `${(i * 41) % 100}%`,
  c: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  d: `${1.6 + ((i * 7) % 10) / 10}s`,
}));

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
          <div className="confetti" aria-hidden="true">
            {CONFETTI.map((p, i) => (
              <i key={i} style={{ '--x': p.x, '--c': p.c, '--d': p.d } as CSSProperties} />
            ))}
          </div>
          <div className="clear-party" aria-hidden="true">
            <HamsterFace />
            <HamsterFace />
            <HamsterFace />
            <HamsterFace />
            <HamsterFace />
          </div>
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
