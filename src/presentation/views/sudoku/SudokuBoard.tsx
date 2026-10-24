import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { SudokuCell } from './SudokuCell';
import type { Violations } from '../../../features/sudoku/model/rules';
import { useBoardInteraction } from '../../../features/sudoku/service/useBoardInteraction';
import type { CellState, Puzzle } from '../../../features/sudoku/model/puzzles';
import type { TapKind } from '../../../features/sudoku/model/tap';
import type { Reaction } from '../../../features/sudoku/model/reaction';

const EMPTY_MARKS: ReadonlySet<string> = new Set();

export interface SudokuBoardProps {
  puzzle: Puzzle;
  cells: CellState[][];
  /** 조각 위에 올린 X 집합. 해당 칸은 X로 그린다. */
  xMarks?: ReadonlySet<string>;
  /** 확정 정답마커 집합. 다른 마커 상태보다 먼저 렌더링한다. */
  autoMarks?: ReadonlySet<string>;
  violations: Violations;
  cleared: boolean;
  pulse?: ReadonlyMap<string, number>;
  hitKey?: string | null;
  shake?: number;
  /** 마지막 확정의 발견 반응. 칸별 표정과 하트 수의 입력이다. */
  reaction?: Reaction | null;
  onCell: (r: number, c: number, kind: TapKind) => void;
  onPress: (r: number, c: number) => void;
  onEnter: (r: number, c: number) => void;
  onRelease: () => boolean;
  clearOverlay?: ReactNode;
}

export function SudokuBoard({
  puzzle,
  cells,
  xMarks = new Set(),
  autoMarks = EMPTY_MARKS,
  violations,
  cleared,
  pulse = new Map(),
  hitKey = null,
  shake = 0,
  reaction = null,
  onCell,
  onPress,
  onEnter,
  onRelease,
  clearOverlay,
}: SudokuBoardProps) {
  const { projected, boardRef, controls, handlePress, handleMove, handleUp, handleClickCapture, handleCancel, handleLeave } =
    useBoardInteraction(puzzle, cells, xMarks, violations, pulse, hitKey, shake, onPress, onEnter, onRelease, autoMarks, reaction);

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
        onPointerLeave={handleLeave}
        onClickCapture={handleClickCapture}
      >
        {projected.map((line) => line.map((cell) => (
          <SudokuCell
            key={`${cell.row}-${cell.col}`}
            {...cell}
            onTap={(kind) => onCell(cell.row, cell.col, kind)}
            onPress={(cancelPendingTap) => handlePress(cell.row, cell.col, cancelPendingTap)}
          />
        )))}
      </div>
      {cleared && clearOverlay}
    </motion.div>
  );
}
