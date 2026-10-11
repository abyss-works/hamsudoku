import type { ReactNode } from 'react';
import { EndlessBoard } from './EndlessBoard';
import { GameHelp } from '../sudoku/GameHelp';
import type { useEndlessGame } from '../../features/endless/service/useEndlessGame';
import { BootSplash } from '../../ui/BootSplash';
import { GameHeader } from '../sudoku/GameHeader';
import { SeedStatus } from '../sudoku/SeedStatus';

export interface EndlessGameScreenProps {
  onBack: () => void;
  session: ReturnType<typeof useEndlessGame>;
  clearOverlay?: ReactNode;
  gameOverOverlay?: ReactNode;
}

export function EndlessGameScreen({
  onBack,
  session,
  clearOverlay,
  gameOverOverlay,
}: EndlessGameScreenProps) {
  if (!session.puzzle) {
    if (session.error) {
      return (
        <div className="game">
          <GameHeader title="무한모드" onBack={onBack} />
          <p role="alert">{session.error}</p>
        </div>
      );
    }
    return session.showEntryLoading ? <BootSplash /> : null;
  }

  return (
    <div className="game">
      <GameHeader
        title="무한모드"
        onBack={onBack}
        extra={
          <SeedStatus
            balance={session.hud.balance}
            bonus={session.hud.seeds}
            ariaLabel={session.hud.ariaLabel}
          />
        }
      />
      <GameHelp probe />
      <EndlessBoard
        key={session.roundId}
        puzzle={session.puzzle}
        onWrong={session.reportWrong}
        onFinish={session.finishBoard}
        clearOverlay={clearOverlay}
      />
      {gameOverOverlay}
    </div>
  );
}
