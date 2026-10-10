import { useRef, useState } from 'react';
import type { Stage } from '../api/stagesApi';
import { formatElapsed, useElapsed } from './useElapsed';
import { useHamSudoku } from './useHamSudoku';
import { playClearSound } from './sound';

export function useStageGame(stage: Stage, onRecord: (stageCode: string, elapsedSec: number) => void) {
  const [runId, setRunId] = useState(0);
  const elapsed = useRef(0);
  const board = useHamSudoku(stage.puzzle, { onClear: () => {
    playClearSound();
    onRecord(stage.code, elapsed.current);
  } });
  const sec = useElapsed(!board.cleared, runId);
  elapsed.current = sec;
  return { ...board, elapsedText: formatElapsed(sec), retry: () => {
    board.reset();
    elapsed.current = 0;
    setRunId((i) => i + 1);
  } };
}
