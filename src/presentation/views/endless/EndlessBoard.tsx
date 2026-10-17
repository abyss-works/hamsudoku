import type { ReactNode } from 'react';
import { SudokuBoard } from '../sudoku/SudokuBoard';
import { ProbeButton } from '../sudoku/ProbeButton';
import { useEndlessBoard } from '../../../features/endless/service/useEndlessBoard';
import type { Puzzle } from '../../../features/sudoku/model/puzzles';
import type { PlayLog } from '../../../shared/endless';

export interface EndlessBoardProps {
  puzzle: Puzzle;
  onWrong: (log: PlayLog) => void;
  onFinish: (log: PlayLog) => void;
  clearOverlay: ReactNode;
}

export function EndlessBoard({ puzzle, onWrong, onFinish, clearOverlay }: EndlessBoardProps) {
  const board = useEndlessBoard(puzzle, onWrong, onFinish);

  return (
    <>
      <SudokuBoard
        puzzle={puzzle}
        cells={board.cells}
        xMarks={board.xMarks}
        autoMarks={board.autoMarks}
        violations={board.violations}
        cleared={board.cleared}
        pulse={board.pulse}
        hitKey={board.hitKey}
        shake={board.shake}
        onCell={board.tapCell}
        onPress={board.beginStroke}
        onEnter={board.strokeEnter}
        onRelease={board.endStroke}
        clearOverlay={clearOverlay}
      />
      <ProbeButton
        active={board.probeActive}
        slots={board.probeSlots}
        onToggle={board.toggleProbe}
        onResetMarks={board.resetMarks}
      />
    </>
  );
}
