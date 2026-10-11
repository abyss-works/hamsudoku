import type { ReactNode } from 'react';
import type { Stage } from '../../features/stages/catalog';
import { Board } from '../sudoku/Board';
import type { useStageGame } from '../../features/stages/useStageGame';
import { GameHelp } from '../sudoku/GameHelp';
import { GameHeader } from '../sudoku/GameHeader';
import { HamsterProgress } from './HamsterProgress';

export interface GameScreenProps {
  stage: Stage;
  onBack: () => void;
  game: ReturnType<typeof useStageGame>;
  clearOverlay?: ReactNode;
}

export function GameScreen({
  stage,
  onBack,
  game,
  clearOverlay,
}: GameScreenProps) {
  return (
    <div className="game">
      <GameHeader title={game.hud.hudText} onBack={onBack} />
      <HamsterProgress dots={game.hud.dots} ariaLabel={game.hud.hamsterDotsLabel} />
      <GameHelp />
      <Board
        puzzle={stage.puzzle}
        cells={game.cells}
        xMarks={game.xMarks}
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
