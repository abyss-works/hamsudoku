import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Heart, X } from 'lucide-react';
import { HamsterFace } from '../ui/HamsterFace';
import type { CellState } from './puzzles';
import { delayForPointerType, type TapKind } from './tap';

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
  mark: '의심 표시',
  hypo: '가설 표시',
  auto: '자동 표시',
  hamster: '햄스터',
  wrong: '틀린 칸',
};

export function Cell({ row, col, state, islandId, conflicted, hit, pulseDelay, onTap, onPress }: CellProps) {
  const timer = useRef<number | null>(null);
  const pointerKind = useRef<string | null>(null);

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
    }, delayForPointerType(pointerKind.current));
  };

  const handlePress = (e: React.PointerEvent) => {
    pointerKind.current = e.pointerType ?? null;
    onPress();
  };

  const handleDoubleClick = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    onTap('double');
  };

  return (
    <motion.button
      type="button"
      className={`btn cell cell-${state}${conflicted ? ' cell-conflict' : ''}${hit ? ' cell-hit' : ''}`}
      data-island={islandId}
      data-state={state}
      data-r={row}
      data-c={col}
      aria-label={`${LABEL[state]} (색 ${islandId + 1})`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePress}
      initial={false}
      animate={
        hit
          ? { boxShadow: ['0 0 0 0 rgb(70 167 88 / 0.8)', '0 0 0 12px rgb(70 167 88 / 0)'] }
          : { boxShadow: '0 0 0 0 rgb(70 167 88 / 0)' }
      }
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <span className="cell-glyph" aria-hidden="true">
        {/* 글리프는 모두 칸 안에 절대 배치되므로 퇴장 중인 것과 새로 들어오는 것이 겹쳐 그려진다 */}
        <AnimatePresence initial={false}>
        {state === 'hamster' ? (
          <motion.span
            key="ham"
            className="cell-glyph-item"
            initial={{ scale: 0.3 }}
            animate={{ scale: [0.3, 1.25, 1] }}
            exit={{ scale: 0.3, opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <HamsterFace />
            <motion.span
              className="ham-heart"
              aria-hidden="true"
              initial={{ opacity: 0, y: 4, scale: 0.5 }}
              animate={{ opacity: [0, 1, 0], y: -8, scale: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              <Heart size={14} fill="currentColor" aria-hidden="true" />
            </motion.span>
          </motion.span>
        ) : state === 'mark' || state === 'hypo' || state === 'wrong' || state === 'auto' ? (
          <motion.span
            key={state}
            className="cell-glyph-item"
            aria-hidden="true"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.3, opacity: 0, transition: { duration: 0.15, delay: 0 } }}
            transition={{ duration: 0.25, delay: (pulseDelay ?? 0) / 1000 }}
          >
            {state === 'hypo' ? (
              <span className="mark-glyph mark-unknown" aria-hidden="true">
                ?
              </span>
            ) : state === 'mark' ? (
              <Check className="mark-glyph mark-check" strokeWidth={3.5} aria-hidden="true" />
            ) : (
              <X
                className={`mark-glyph${state === 'wrong' ? ' mark-wrong' : ''}${state === 'auto' ? ' mark-auto' : ''}`}
                strokeWidth={3}
                aria-hidden="true"
              />
            )}
          </motion.span>
        ) : null}
        </AnimatePresence>
      </span>
    </motion.button>
  );
}
