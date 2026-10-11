import type { Stage } from '../features/stages/catalog';
import { useStageGame } from '../features/stages/useStageGame';
import { OverlayProvider } from '../ui/OverlayProvider';
import { GameScreen } from '../views/stages/GameScreen';
import { StageOverlayHost } from './StageOverlayHost';

export interface StageSceneProps {
  stage: Stage;
  onBack: () => void;
  onNextMap: () => void;
  onRecord: (stageCode: string, elapsedSec: number) => void;
}

function StageSceneContent({ stage, onBack, onNextMap, onRecord }: StageSceneProps) {
  const game = useStageGame(stage, onRecord);

  return (
    <GameScreen
      stage={stage}
      onBack={onBack}
      game={game}
      clearOverlay={
        <StageOverlayHost
          total={stage.puzzle.size}
          onReset={game.retry}
          onNextMap={onNextMap}
          onBrowse={onBack}
        />
      }
    />
  );
}

export function StageScene(props: StageSceneProps) {
  return (
    <OverlayProvider initialScopeId={`game-${props.stage.id}`}>
      <StageSceneContent {...props} />
    </OverlayProvider>
  );
}
