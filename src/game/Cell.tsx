import { useEffect, useRef, type CSSProperties } from 'react';
import { Heart, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { HamsterFace } from '../ui/HamsterFace';
import type { CellState } from './puzzles';
import type { TapKind } from './tap';

interface CellProps {
  row: number;
  col: number;
  state: CellState;
  islandId: number;
  conflicted: boolean;
  hit?: boolean;
  pulseDelay?: number;
  onTap: (kind: TapKind) => void;
  onPress: () => void;
}

const LABEL: Record<CellState, string> = {
  empty: '빈칸',
  mark: 'X 표시',
  auto: '자동 표시',
  hamster: '햄스터',
  wrong: '틀린 칸',
};

const SINGLE_TAP_MS = 180;

export function Cell({ row, col, state, islandId, conflicted, hit, pulseDelay, onTap, onPress }: CellProps) {
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const handleClick = () => {
    // 두 번째 탭이 윈도우 안에 들어오면 브라우저 dblclick과 무관하게 더블로 확정한다.
    // (모바일 더블탭은 dblclick을 안 주는 경우가 있어 클릭 타이밍으로 직접 판정)
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
      onTap('double');
      return;
    }
    timer.current = window.setTimeout(() => {
      timer.current = null;
      onTap('single');
    }, SINGLE_TAP_MS);
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
      className={`cell cell-${state}${conflicted ? ' cell-conflict' : ''}${hit ? ' cell-hit' : ''}${
        pulseDelay !== undefined ? ' cell-pulse' : ''
      }`}
      data-island={islandId}
      data-state={state}
      data-r={row}
      data-c={col}
      aria-label={`${LABEL[state]} (색 ${islandId + 1})`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onPointerDown={onPress}
      style={pulseDelay !== undefined ? ({ '--d': `${pulseDelay}ms` } as CSSProperties) : undefined}
    >
      <span key={state} className={`cell-glyph${state === 'hamster' ? ' pop' : ''}`} aria-hidden="true">
        {state === 'hamster' ? (
          <>
            <HamsterFace />
            <Heart className="ham-heart" size={14} fill="currentColor" aria-hidden="true" />
          </>
        ) : state === 'mark' ? (
          <X className="mark-x" strokeWidth={3} aria-hidden="true" />
        ) : state === 'wrong' ? (
          <X className="mark-x mark-wrong" strokeWidth={3} aria-hidden="true" />
        ) : state === 'auto' ? (
          <X className="mark-x mark-auto" strokeWidth={3} aria-hidden="true" />
        ) : (
          ''
        )}
      </span>
    </Button>
  );
}
