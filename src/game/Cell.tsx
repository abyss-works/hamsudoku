import { AnimatePresence, motion } from 'framer-motion';
import { Heart, X } from 'lucide-react';
import { HamsterFace } from '../ui/HamsterFace';
import type { CellState } from './puzzles';
import type { TapKind } from './tap';
import { useCellInteraction } from './useCellInteraction';

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
  anchor: '임시 정답 표시',
  frag: '물음표 표시',
  auto: '자동 표시',
  hamster: '햄스터',
  wrong: '틀린 칸',
};

export function Cell({ row, col, state, islandId, conflicted, hit, pulseDelay, onTap, onPress }: CellProps) {
  const { handleClick, handlePress, handleDoubleClick } = useCellInteraction(onTap, onPress);

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
        ) : state === 'anchor' ? (
          <motion.span
            key="anchor"
            className="cell-glyph-item"
            aria-hidden="true"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.3, opacity: 0, transition: { duration: 0.15, delay: (pulseDelay ?? 0) / 1000 } }}
            transition={{ duration: 0.25, delay: (pulseDelay ?? 0) / 1000 }}
          >
            <HamsterFace />
            <span className="anchor-badge" aria-hidden="true">
              ?
            </span>
          </motion.span>
        ) : state === 'mark' || state === 'frag' || state === 'wrong' || state === 'auto' ? (
          <motion.span
            key={state}
            className="cell-glyph-item"
            aria-hidden="true"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.3, opacity: 0, transition: { duration: 0.15, delay: (pulseDelay ?? 0) / 1000 } }}
            transition={{ duration: 0.25, delay: (pulseDelay ?? 0) / 1000 }}
          >
            {state === 'frag' ? (
              <>
                <X className="mark-glyph" strokeWidth={3} aria-hidden="true" />
                <span className="anchor-badge" aria-hidden="true">
                  ?
                </span>
              </>
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
