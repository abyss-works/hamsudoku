import { useRef, useState } from 'react';
import type { Stage } from '../model/catalog';
import { useElapsed } from './useElapsed';
import { useHamSudoku } from '../../sudoku/service/useHamSudoku';
import { playClearSound } from '../../../platform/audio/sound';
import type { OverlayActions } from '../../../shared/overlay';

export function useStageGame(
  stage: Stage,
  onRecord: (stageCode: string, elapsedSec: number) => void,
  overlay: OverlayActions,
) {
  const [runId, setRunId] = useState(0);
  const elapsed = useRef(0);

  const board = useHamSudoku(stage.puzzle, {
    onClear: () => {
      playClearSound();
      onRecord(stage.code, elapsed.current);
      overlay.open({ type: 'clear', slot: 'stage-clear' });
    },
  });
  const sec = useElapsed(!board.cleared, runId);
  elapsed.current = sec;

  return {
    ...board,
    elapsedSec: sec,
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
