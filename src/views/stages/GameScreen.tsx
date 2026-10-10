import type { Stage } from '../../features/stages/catalog';
import { Board } from '../sudoku/Board';
import { useStageGame } from '../../features/stages/useStageGame';
import { GameHelp } from '../sudoku/GameHelp';
import { Button } from '../../ui/Button';

export interface GameScreenProps {
  stage: Stage;
  onBack: () => void;
  onNextMap: () => void;
  onRecord: (stageCode: string, elapsedSec: number) => void;
}

export function GameScreen({ stage, onBack, onNextMap, onRecord }: GameScreenProps) {
  const { cells, xMarks, violations, cleared, pulse, hitKey, shake, tapCell, beginStroke, strokeEnter, endStroke, retry, hud } =
    useStageGame(stage, onRecord);

  return (
    <div className="game">
      <div className="hud">
        <Button variant="sticker" onClick={onBack}>
          뒤로
        </Button>
        <span className="hud-code">{hud.hudText}</span>
        <span />
      </div>
      <div className="dots" role="status" aria-label={hud.hamsterDotsLabel}>
        {hud.dots.map((dot) => (
          <span key={dot.id} className={dot.on ? 'dot on' : 'dot'} aria-hidden="true" />
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
