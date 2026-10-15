import { useEndlessGame } from '../../features/endless/service/useEndlessGame';
import { useEndlessSession, type EndlessSessionOptions } from '../../features/endless/service/useEndlessSession';
import { OverlayProvider } from './OverlayProvider';
import { EndlessGameScreen } from '../../presentation/views/endless/EndlessGameScreen';
import { useOverlayScope } from '../orchestration/useOverlayScope';
import { useDelayedLoading } from '../orchestration/useDelayedLoading';
import { useLoading } from './LoadingProvider';
import {
  EndlessClearOverlayHost,
  EndlessGameOverOverlayHost,
} from './EndlessOverlayHost';

export interface EndlessSceneProps extends EndlessSessionOptions {
  onBack: () => void;
}

function EndlessSceneContent({ onBack, owner, seed }: EndlessSceneProps) {
  const sessionState = useEndlessSession({ owner, seed });
  const overlay = useOverlayScope(`endless-${sessionState.roundId}`);
  const { track } = useLoading();
  const showEntryLoading = useDelayedLoading(!sessionState.puzzle);
  const session = useEndlessGame(sessionState, { overlay, track, showEntryLoading });

  return (
    <EndlessGameScreen
      onBack={onBack}
      session={session}
      clearOverlay={
        <EndlessClearOverlayHost
          clearModel={session.clearModel}
          onNext={session.next}
          onExit={onBack}
        />
      }
      gameOverOverlay={
        <EndlessGameOverOverlayHost
          error={session.error}
          onRetry={session.next}
          onExit={onBack}
        />
      }
    />
  );
}

export function EndlessScene(props: EndlessSceneProps) {
  return (
    <OverlayProvider initialScopeId="endless">
      <EndlessSceneContent {...props} />
    </OverlayProvider>
  );
}
