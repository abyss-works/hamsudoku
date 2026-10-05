import { useEffect, useRef } from 'react';
import type { Stage } from '../api/stagesApi';
import { Board } from '../game/Board';
import { ControlsHelp } from '../game/ControlsHelp';
import { formatElapsed, useElapsed } from '../game/useElapsed';
import { useHamSudoku } from '../game/useHamSudoku';
import { RulesHelp } from '../game/RulesHelp';
import { Button } from '../ui/Button';

interface GameScreenProps {
  stage: Stage;
  onBack: () => void;
  onNextMap: () => void;
  onRecord: (stageCode: string, elapsedSec: number) => void;
}

export function GameScreen({ stage, onBack, onNextMap, onRecord }: GameScreenProps) {
  const { cells, violations, cleared, hamsterCount, pulse, hitKey, shake, tapCell, beginStroke, strokeEnter, endStroke, reset } = useHamSudoku(stage.puzzle);
  const sec = useElapsed(!cleared);
  const wasCleared = useRef(false);

  useEffect(() => {
    if (cleared && !wasCleared.current) {
      wasCleared.current = true;
      onRecord(stage.code, sec);
    } else if (!cleared) {
      wasCleared.current = false;
    }
  }, [cleared, onRecord, stage.code, sec]);

  return (
    <div className="game">
      <div className="hud">
        <Button variant="sticker" onClick={onBack}>
          뒤로
        </Button>
        <span className="hud-code">
          {stage.code} · {formatElapsed(sec)}
        </span>
        <Button variant="sticker" onClick={reset}>
          리셋
        </Button>
      </div>
      <div className="dots" role="status" aria-label={`햄스터 ${hamsterCount}/${stage.puzzle.size}`}>
        {Array.from({ length: stage.puzzle.size }, (_, i) => (
          <span key={i} className={i < hamsterCount ? 'dot on' : 'dot'} aria-hidden="true" />
        ))}
      </div>
      <RulesHelp />
      <Board
        puzzle={stage.puzzle}
        cells={cells}
        violations={violations}
        cleared={cleared}
        pulse={pulse}
        hitKey={hitKey}
        shake={shake}
        onCell={tapCell}
        onPress={beginStroke}
        onEnter={strokeEnter}
        onRelease={endStroke}
        onReset={reset}
        onNextMap={onNextMap}
        onBrowse={onBack}
      />
      <ControlsHelp />
    </div>
  );
}
