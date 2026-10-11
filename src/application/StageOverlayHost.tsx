import type { ReactNode } from 'react';
import { ClearDialog } from '../views/sudoku/ClearDialog';
import { OverlayOutlet } from '../ui/OverlayOutlet';

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
            />
          );
        }
        return null;
      }}
    />
  );
}
