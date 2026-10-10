import type { Puzzle } from '../sudoku/model/puzzles';
import { useHamSudoku } from '../sudoku/useHamSudoku';

export function useEndlessBoard(puzzle: Puzzle, onWrong: () => void, onFinish: () => void) {
  const board = useHamSudoku(puzzle, { onWrong, onClear: onFinish });
  return { ...board, toggleProbe: () => board.setProbeActive(!board.probeActive) };
}
