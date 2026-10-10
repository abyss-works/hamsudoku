import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Cell } from './Cell';
import { ClearDialog } from './ClearDialog';
import type { Violations } from '../model/rules';
import { useBoardInteraction } from '../useBoardInteraction';
import type { CellState, Puzzle } from '../model/puzzles';
import type { TapKind } from '../model/tap';

interface BoardProps {
  puzzle: Puzzle;
  cells: CellState[][];
  /** 조각 위에 올린 X 집합. 해당 칸은 X로 그린다. */
  xMarks?: ReadonlySet<string>;
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
  onBrowse: () => void;
  clearOverlay?: ReactNode;
}

export function Board({
  puzzle,
  cells,
  xMarks = new Set(),
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
  onBrowse,
  clearOverlay,
}: BoardProps) {
  const { projected, boardRef, controls, handlePress, handleMove, handleUp, handleClickCapture, handleCancel } =
    useBoardInteraction(puzzle, cells, xMarks, violations, pulse, hitKey, shake, onPress, onEnter, onRelease);

  return (
    <motion.div className={`board-wrap${shake > 0 ? ' shake' : ''}`} animate={controls}>
      <div
        ref={boardRef}
        className="board"
        role="grid"
        aria-label={puzzle.name}
        style={{ gridTemplateColumns: `repeat(${puzzle.size}, 1fr)` }}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleCancel}
        onClickCapture={handleClickCapture}
      >
        {projected.map((line) => line.map((cell) => (
          <Cell
            key={`${cell.row}-${cell.col}`}
            {...cell}
            onTap={(kind) => onCell(cell.row, cell.col, kind)}
            onPress={() => handlePress(cell.row, cell.col)}
          />
        )))}
      </div>
      {cleared &&
        (clearOverlay ?? <ClearDialog total={puzzle.size} onReset={onReset} onNextMap={onNextMap} onBrowse={onBrowse} />)}
    </motion.div>
  );
}
