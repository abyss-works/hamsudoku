import { useEndlessGame } from '../features/endless/service/useEndlessGame';
import { OverlayProvider } from '../ui/OverlayProvider';
import { EndlessGameScreen } from '../views/endless/EndlessGameScreen';
import {
  EndlessClearOverlayHost,
  EndlessGameOverOverlayHost,
} from './EndlessOverlayHost';

export interface EndlessSceneProps {
  onBack: () => void;
}

function EndlessSceneContent({ onBack }: EndlessSceneProps) {
  const session = useEndlessGame();

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
