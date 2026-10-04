import { Heart, Sprout } from 'lucide-react';
import { Button } from '../ui/Button';
import { HamsterFace } from '../ui/HamsterFace';
import type { CellState } from './puzzles';

interface CellProps {
  state: CellState;
  islandId: number;
  conflicted: boolean;
  onTap: () => void;
}

const LABEL: Record<CellState, string> = {
  empty: '빈칸',
  hamster: '햄스터',
  seed: '씨앗 표시',
};

export function Cell({ state, islandId, conflicted, onTap }: CellProps) {
  return (
    <Button
      className={`cell cell-${state}${conflicted ? ' cell-conflict' : ''}`}
      data-island={islandId}
      data-state={state}
      aria-label={`${LABEL[state]} (섬 ${islandId + 1})`}
      onClick={onTap}
    >
      <span key={state} className={`cell-glyph${state === 'hamster' ? ' pop' : ''}`} aria-hidden="true">
        {state === 'hamster' ? (
          <>
            <HamsterFace />
            <Heart className="ham-heart" size={14} fill="currentColor" aria-hidden="true" />
          </>
        ) : state === 'seed' ? (
          <Sprout className="seed-mark" aria-hidden="true" />
        ) : (
          ''
        )}
      </span>
    </Button>
  );
}
