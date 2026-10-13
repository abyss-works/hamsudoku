import type { Stage } from '../../features/stages/model/catalog';
import { useStageGame } from '../../features/stages/service/useStageGame';
import { OverlayProvider } from './OverlayProvider';
import { useOverlayScope } from '../orchestration/useOverlayScope';
import { GameScreen } from '../../presentation/views/stages/GameScreen';
import { StageOverlayHost } from './StageOverlayHost';

export interface StageSceneProps {
  stage: Stage;
  onBack: () => void;
  onNextMap: () => void;
  onRecord: (stageCode: string, elapsedSec: number) => void;
}

function StageSceneContent({ stage, onBack, onNextMap, onRecord }: StageSceneProps) {
  const overlay = useOverlayScope(`stage-${stage.code}`);
  const game = useStageGame(stage, onRecord, overlay);

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
