import type { CellState } from './puzzles';

export type TapKind = 'single' | 'double';

export function nextState(state: CellState, kind: TapKind, isCorrect: boolean): CellState {
  if (kind === 'single') {
    if (state === 'empty') return 'mark';
    if (state === 'mark') return 'empty';
    if (state === 'hamster') return 'empty';
    return 'wrong';
  }
  if (state === 'empty' || state === 'mark') return isCorrect ? 'hamster' : 'wrong';
  return state;
}
