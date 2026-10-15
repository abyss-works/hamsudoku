import type { ReactNode } from 'react';
import type { Stage } from '../../../features/stages/model/catalog';
import { SudokuBoard } from '../sudoku/SudokuBoard';
import type { StageGameView } from '../../../features/stages/service/useStageGame';
import { GameHelpPanel } from '../sudoku/GameHelpPanel';
import { GameHeader } from '../sudoku/GameHeader';
import { HamsterProgress } from './HamsterProgress';
import { formatElapsed } from '../../ui/timeFormatter';
import { stageHudModel } from './stageHudModel';

export interface GameScreenProps {
  stage: Stage;
  onBack: () => void;
  game: StageGameView;
  clearOverlay?: ReactNode;
}

export function GameScreen({
  stage,
  onBack,
  game,
  clearOverlay,
}: GameScreenProps) {
  const hud = stageHudModel(stage.code, formatElapsed(game.elapsedSec), game.hamsterCount, stage.puzzle.size);

  return (
    <div className="game">
      <GameHeader title={hud.hudText} onBack={onBack} />
      <HamsterProgress dots={hud.dots} ariaLabel={hud.hamsterDotsLabel} />
      <GameHelpPanel />
      <SudokuBoard
        puzzle={stage.puzzle}
        cells={game.cells}
        xMarks={game.xMarks}
        autoMarks={game.autoMarks}
        violations={game.violations}
        cleared={game.cleared}
        pulse={game.pulse}
        hitKey={game.hitKey}
        shake={game.shake}
        onCell={game.tapCell}
        onPress={game.beginStroke}
        onEnter={game.strokeEnter}
        onRelease={game.endStroke}
        clearOverlay={clearOverlay}
      />
    </div>
  );
}
