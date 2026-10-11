import type { ReactNode } from 'react';
import { EndlessClearDialog } from '../views/endless/EndlessClearDialog';
import { GameOverDialog } from '../views/endless/GameOverDialog';
import type { EndlessClearModel } from '../features/endless/model/screenModels';
import { OverlayOutlet } from '../ui/OverlayOutlet';

export interface EndlessClearOverlayHostProps {
  clearModel: EndlessClearModel | null;
  onNext: () => void;
  onExit: () => void;
}

export function EndlessClearOverlayHost({
  clearModel,
  onNext,
  onExit,
}: EndlessClearOverlayHostProps): ReactNode {
  return (
    <OverlayOutlet
      slot="endless-clear"
      render={(request) => {
        if (request.type === 'clear' && clearModel) {
          return (
            <EndlessClearDialog
              model={clearModel}
              onNext={onNext}
              onExit={onExit}
            />
          );
        }
        return null;
      }}
    />
  );
}

export interface EndlessGameOverOverlayHostProps {
  error: string | null;
  onRetry: () => void;
  onExit: () => void;
}

export function EndlessGameOverOverlayHost({
  error,
  onRetry,
  onExit,
}: EndlessGameOverOverlayHostProps): ReactNode {
  return (
    <OverlayOutlet
      slot="endless-gameover"
      render={(request) => {
        if (request.type === 'gameover') {
          return (
            <GameOverDialog
              error={error}
              onRetry={onRetry}
              onExit={onExit}
            />
          );
        }
        return null;
      }}
    />
  );
}
