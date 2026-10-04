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
    <button
      type="button"
      className={`cell cell-${state}${conflicted ? ' cell-conflict' : ''}`}
      data-island={islandId}
      data-state={state}
      aria-label={`${LABEL[state]} (섬 ${islandId + 1})`}
      onClick={onTap}
    >
      <span key={state} className="cell-glyph" aria-hidden="true">
        {state === 'hamster' ? '🐹' : state === 'seed' ? '🌻' : ''}
      </span>
    </button>
  );
}
