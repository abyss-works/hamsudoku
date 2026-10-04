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
  onPaint: (r: number, c: number, toMark: boolean) => void;
  onReset: () => void;
  onNextMap: () => void;
}

interface Drag {
  sr: number;
  sc: number;
  toMark: boolean;
  engaged: boolean;
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
  onPaint,
  onReset,
  onNextMap,
}: BoardProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
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
    const state = cells[r][c];
    if (state !== 'empty' && state !== 'mark') {
      dragRef.current = null;
      return;
    }
    dragRef.current = { sr: r, sc: c, toMark: state === 'empty', engaged: false };
  };

  const handleMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      dragRef.current = null;
      return;
    }
    const hit = cellFromPoint(e.clientX, e.clientY);
    if (!hit || (hit[0] === drag.sr && hit[1] === drag.sc)) return;
    if (!drag.engaged) {
      drag.engaged = true;
      onPaint(drag.sr, drag.sc, drag.toMark);
    }
    onPaint(hit[0], hit[1], drag.toMark);
  };

  const handleUp = () => {
    if (dragRef.current?.engaged) suppressClick.current = true;
    dragRef.current = null;
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
          dragRef.current = null;
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
