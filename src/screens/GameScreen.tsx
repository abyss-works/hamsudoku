import { useEffect, useRef, useState } from 'react';
import type { Stage } from '../api/stagesApi';
import { Board } from '../game/Board';
import { formatElapsed, useElapsed } from '../game/useElapsed';
import { useHamSudoku } from '../game/useHamSudoku';
import { playSfx } from '../game/sound';
import { GameHelp } from '../game/GameHelp';
import { Button } from '../ui/Button';

interface GameScreenProps {
  stage: Stage;
  onBack: () => void;
  onNextMap: () => void;
  onRecord: (stageCode: string, elapsedSec: number) => void;
}

export function GameScreen({ stage, onBack, onNextMap, onRecord }: GameScreenProps) {
  const { cells, xMarks, violations, cleared, hamsterCount, pulse, hitKey, shake, tapCell, beginStroke, strokeEnter, endStroke, reset } =
    useHamSudoku(stage.puzzle);
  const [runId, setRunId] = useState(0);
  const sec = useElapsed(!cleared, runId);
  const wasCleared = useRef(false);

  useEffect(() => {
    if (cleared && !wasCleared.current) {
      wasCleared.current = true;
      playSfx('clear');
      onRecord(stage.code, sec);
    } else if (!cleared) {
      wasCleared.current = false;
    }
  }, [cleared, onRecord, stage.code, sec]);

  // 다시하기는 보드와 시간을 함께 되돌린다.
  const retry = () => {
    reset();
    setRunId((i) => i + 1);
  };

  return (
    <div className="game">
      <div className="hud">
        <Button variant="sticker" onClick={onBack}>
          뒤로
        </Button>
        <span className="hud-code">
          {stage.code} · {formatElapsed(sec)}
        </span>
        <span />
      </div>
      <div className="dots" role="status" aria-label={`햄스터 ${hamsterCount}/${stage.puzzle.size}`}>
        {Array.from({ length: stage.puzzle.size }, (_, i) => (
          <span key={i} className={i < hamsterCount ? 'dot on' : 'dot'} aria-hidden="true" />
        ))}
      </div>
      <GameHelp />
      <Board
        puzzle={stage.puzzle}
        cells={cells}
        xMarks={xMarks}
        violations={violations}
        cleared={cleared}
        pulse={pulse}
        hitKey={hitKey}
        shake={shake}
        onCell={tapCell}
        onPress={beginStroke}
        onEnter={strokeEnter}
        onRelease={endStroke}
        onReset={retry}
        onNextMap={onNextMap}
        onBrowse={onBack}
      />
    </div>
  );
}
