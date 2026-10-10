import { EndlessBoard } from './EndlessBoard';
import { EndlessClearDialog } from './EndlessClearDialog';
import { GameOverDialog } from './GameOverDialog';
import { GameHelp } from '../sudoku/GameHelp';
import { useEndlessGame } from '../../features/endless/useEndlessGame';
import { Button } from '../../ui/Button';
import { BootSplash } from '../../ui/BootSplash';
import { Sprout } from 'lucide-react';

export function EndlessGameScreen({ onBack }: { onBack: () => void }) {
  const session = useEndlessGame();

  if (!session.puzzle) {
    if (session.error) {
      return (
        <div className="game">
          <div className="hud">
            <Button variant="sticker" onClick={onBack}>
              뒤로
            </Button>
            <span className="hud-code">무한모드</span>
            <span />
          </div>
          <p role="alert">{session.error}</p>
        </div>
      );
    }
    return session.showEntryLoading ? <BootSplash /> : null;
  }

  return (
    <div className="game">
      <div className="hud">
        <Button variant="sticker" onClick={onBack}>
          뒤로
        </Button>
        <span className="hud-code">무한모드</span>
        <span className="seed-box" role="status" aria-label={session.hud.ariaLabel}>
          <Sprout size={20} aria-hidden="true" />
          <span className="seed-count">{session.hud.balance}</span>
          <span className="seed-lives" aria-hidden="true">
            +{session.hud.seeds}
          </span>
        </span>
      </div>
      <GameHelp probe />
      <EndlessBoard
        key={session.stageId ?? 'loading'}
        puzzle={session.puzzle}
        onWrong={session.reportWrong}
        onFinish={session.finishBoard}
        clearOverlay={
          <EndlessClearDialog
            model={session.clearModel}
            onNext={session.next}
            onExit={onBack}
          />
        }
      />
      {session.phase === 'gameover' && (
        <GameOverDialog
          error={session.error}
          onRetry={session.next}
          onExit={onBack}
        />
      )}
    </div>
  );
}
