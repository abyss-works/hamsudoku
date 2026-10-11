import { useRef, useState } from 'react';
import type { Stage } from './stagesApi';
import { formatElapsed, useElapsed } from '../sudoku/service/useElapsed';
import { useHamSudoku } from '../sudoku/service/useHamSudoku';
import { playClearSound } from '../../platform/audio/sound';
import { stageHudModel } from './selectionLogic';
import { useOverlayScope } from '../../ui/useOverlayScope';

export function useStageGame(stage: Stage, onRecord: (stageCode: string, elapsedSec: number) => void) {
  const [runId, setRunId] = useState(0);
  const elapsed = useRef(0);
  const overlay = useOverlayScope(`stage-${stage.code}-${runId}`);

  const board = useHamSudoku(stage.puzzle, {
    onClear: () => {
      playClearSound();
      onRecord(stage.code, elapsed.current);
      overlay.open({ type: 'clear', slot: 'stage-clear' });
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
    closeClear: () => {
      overlay.close({ slot: 'stage-clear' });
    },
    retry: () => {
      overlay.close({ slot: 'stage-clear' });
      board.reset();
      elapsed.current = 0;
      setRunId((i) => i + 1);
    },
  };
}
