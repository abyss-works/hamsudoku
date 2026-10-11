import type { ReactNode } from 'react';
import { Board } from '../sudoku/Board';
import { ProbeButton } from '../sudoku/ProbeButton';
import { useEndlessBoard } from '../../features/endless/service/useEndlessBoard';
import type { Puzzle } from '../../features/sudoku/model/puzzles';

export interface EndlessBoardProps {
  puzzle: Puzzle;
  onWrong: () => void;
  onFinish: () => void;
  clearOverlay: ReactNode;
}

export function EndlessBoard({ puzzle, onWrong, onFinish, clearOverlay }: EndlessBoardProps) {
  const board = useEndlessBoard(puzzle, onWrong, onFinish);

  return (
    <>
      <Board
        puzzle={puzzle}
        cells={board.cells}
        xMarks={board.xMarks}
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
