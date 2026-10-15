import type { ReactNode } from 'react';
import { ClearDialog } from '../../presentation/views/sudoku/ClearDialog';
import { OverlayOutlet } from './OverlayOutlet';
import { useReducedMotion } from '../../platform/motion/useReducedMotion';

export interface StageOverlayHostProps {
  total: number;
  onReset: () => void;
  onNextMap: () => void;
  onBrowse: () => void;
}

export function StageOverlayHost({
  total,
  onReset,
  onNextMap,
  onBrowse,
}: StageOverlayHostProps): ReactNode {
  const reduceMotion = useReducedMotion();
  return (
    <OverlayOutlet
      slot="stage-clear"
      render={(request) => {
        if (request.type === 'clear') {
          return (
            <ClearDialog
              total={total}
              onReset={onReset}
              onNextMap={onNextMap}
              onBrowse={onBrowse}
              reduceMotion={reduceMotion}
            />
          );
        }
        return null;
      }}
    />
  );
}
