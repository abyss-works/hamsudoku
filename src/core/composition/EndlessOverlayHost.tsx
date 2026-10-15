import type { ReactNode } from 'react';
import { EndlessClearDialog } from '../../presentation/views/endless/EndlessClearDialog';
import { GameOverDialog } from '../../presentation/views/endless/GameOverDialog';
import type { EndlessClearModel } from '../../features/endless/model/screenModels';
import { OverlayOutlet } from './OverlayOutlet';
import { useReducedMotion } from '../../platform/motion/useReducedMotion';

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
  const reduceMotion = useReducedMotion();
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
              reduceMotion={reduceMotion}
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
