import type { Stage } from './stagesApi';
import { Board } from '../sudoku/ui/Board';
import { useStageGame } from './useStageGame';
import { GameHelp } from '../sudoku/ui/GameHelp';
import { Button } from '../../ui/Button';

interface GameScreenProps {
  stage: Stage;
  onBack: () => void;
  onNextMap: () => void;
  onRecord: (stageCode: string, elapsedSec: number) => void;
}

export function GameScreen({ stage, onBack, onNextMap, onRecord }: GameScreenProps) {
  const { cells, xMarks, violations, cleared, hamsterCount, pulse, hitKey, shake, tapCell, beginStroke, strokeEnter, endStroke, retry, elapsedText } = useStageGame(stage, onRecord);

  return (
    <div className="game">
      <div className="hud">
        <Button variant="sticker" onClick={onBack}>
          뒤로
        </Button>
        <span className="hud-code">
          {stage.code} · {elapsedText}
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
