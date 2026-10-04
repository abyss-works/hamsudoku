import { useEffect, useRef } from 'react';
import { Heart, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { HamsterFace } from '../ui/HamsterFace';
import type { CellState } from './puzzles';
import type { TapKind } from './tap';

interface CellProps {
  state: CellState;
  islandId: number;
  conflicted: boolean;
  onTap: (kind: TapKind) => void;
}

const LABEL: Record<CellState, string> = {
  empty: '빈칸',
  mark: 'X 표시',
  hamster: '햄스터',
  wrong: '틀린 칸',
};

export function Cell({ state, islandId, conflicted, onTap }: CellProps) {
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const handleClick = () => {
    if (timer.current !== null) return;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      onTap('single');
    }, 250);
  };

  const handleDoubleClick = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    onTap('double');
  };

  return (
    <Button
      className={`cell cell-${state}${conflicted ? ' cell-conflict' : ''}`}
      data-island={islandId}
      data-state={state}
      aria-label={`${LABEL[state]} (섬 ${islandId + 1})`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <span key={state} className={`cell-glyph${state === 'hamster' ? ' pop' : ''}`} aria-hidden="true">
        {state === 'hamster' ? (
          <>
            <HamsterFace />
            <Heart className="ham-heart" size={14} fill="currentColor" aria-hidden="true" />
          </>
        ) : state === 'mark' ? (
          <X className="mark-x" aria-hidden="true" />
        ) : state === 'wrong' ? (
          <X className="mark-x mark-wrong" aria-hidden="true" />
        ) : (
          ''
        )}
      </span>
    </Button>
  );
}
