import { useRef, useState } from 'react';
import type { Stage } from './stagesApi';
import { formatElapsed, useElapsed } from '../sudoku/useElapsed';
import { useHamSudoku } from '../sudoku/useHamSudoku';
import { playClearSound } from '../../platform/audio/sound';
import { stageHudModel } from './selectionLogic';

export function useStageGame(stage: Stage, onRecord: (stageCode: string, elapsedSec: number) => void) {
  const [runId, setRunId] = useState(0);
  const elapsed = useRef(0);
  const board = useHamSudoku(stage.puzzle, {
    onClear: () => {
      playClearSound();
      onRecord(stage.code, elapsed.current);
    },
  });
  const sec = useElapsed(!board.cleared, runId);
  elapsed.current = sec;

  const elapsedText = formatElapsed(sec);
  const hud = stageHudModel(stage.code, elapsedText, board.hamsterCount, stage.puzzle.size);

  return {
    ...board,
    elapsedText,
    hud,
    retry: () => {
      board.reset();
      elapsed.current = 0;
      setRunId((i) => i + 1);
    },
  };
}
