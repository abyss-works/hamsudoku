import { useState } from 'react';
import type { PlayLog } from '../../../shared/endless';
import type { Puzzle } from '../../sudoku/model/puzzles';
import { useHamSudoku } from '../../sudoku/service/useHamSudoku';
import { createPlayRecorder } from '../model/playLog';

const monotonicNow = () => performance.now();

/**
 * 무한모드 판 보드. 보드 인스턴스마다 조작 기록기를 만들어 판 단위로 기록하고,
 * 오답·클리어 보고에 그 시점까지의 기록을 싣는다. 시각은 단조 시계로 잰다.
 */
export function useEndlessBoard(
  puzzle: Puzzle,
  onWrong: (log: PlayLog) => void,
  onFinish: (log: PlayLog) => void,
  now: () => number = monotonicNow,
) {
  const [recorder] = useState(() => createPlayRecorder(now));
  const board = useHamSudoku(puzzle, {
    onTransition: (action, sounds) => recorder.record(action, sounds),
    onWrong: () => onWrong(recorder.snapshot()),
    onClear: () => onFinish(recorder.snapshot()),
  });
  return { ...board, toggleProbe: () => board.setProbeActive(!board.probeActive) };
}
