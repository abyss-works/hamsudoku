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
  onPress: (r: number, c: number) => void;
  onEnter: (r: number, c: number) => void;
  onRelease: () => boolean;
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
  onPress,
  onEnter,
  onRelease,
  onReset,
  onNextMap,
}: BoardProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
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

  const cellFromPoint = (x: number, y: number): [number, number] | null => {
    const el = document.elementFromPoint(x, y)?.closest?.('.cell');
    if (!el) return null;
    const r = Number((el as HTMLElement).dataset.r);
    const c = Number((el as HTMLElement).dataset.c);
    if (!Number.isInteger(r) || !Number.isInteger(c)) return null;
    return [r, c];
  };

  const handlePress = (r: number, c: number) => {
    onPress(r, c);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      onRelease();
      return;
    }
    const hit = cellFromPoint(e.clientX, e.clientY);
    if (!hit) return;
    onEnter(hit[0], hit[1]);
  };

  const handleUp = () => {
    if (onRelease()) suppressClick.current = true;
  };

  const handleClickCapture = (e: React.SyntheticEvent) => {
    if (!suppressClick.current) return;
    e.stopPropagation();
    suppressClick.current = false;
  };

  return (
    <div className="board-wrap" ref={wrapRef}>
      <div
        className="board"
        role="grid"
        aria-label={puzzle.name}
        style={{ gridTemplateColumns: `repeat(${puzzle.size}, 1fr)` }}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={() => {
          onRelease();
        }}
        onClickCapture={handleClickCapture}
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
                row={r}
                col={c}
                state={state}
                islandId={puzzle.islands[r][c]}
                conflicted={conflicted}
                hit={hitKey === key}
                pulseDelay={pulse.get(key)}
                onTap={(kind) => onCell(r, c, kind)}
                onPress={() => handlePress(r, c)}
              />
            );
          }),
        )}
      </div>
      {cleared && <ClearDialog onReset={onReset} onNextMap={onNextMap} />}
    </div>
  );
}
