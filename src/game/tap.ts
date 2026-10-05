import type { CellState } from './puzzles';

export type TapKind = 'single' | 'double';

export const SINGLE_TAP_MS_MOUSE = 150;
export const SINGLE_TAP_MS_TOUCH = 250;

export function delayForPointerType(t: string | null | undefined): number {
  return t === 'touch' ? SINGLE_TAP_MS_TOUCH : SINGLE_TAP_MS_MOUSE;
}

export function nextState(state: CellState, kind: TapKind, isCorrect: boolean): CellState {
  if (state === 'wrong' || state === 'auto') return state;
  if (kind === 'single') {
    if (state === 'empty') return 'mark';
    if (state === 'mark') return 'empty';
    return 'empty';
  }
  if (state === 'empty' || state === 'mark') return isCorrect ? 'hamster' : 'wrong';
  return state;
}

/** 정답 칸에서 퍼져나가는 자동 마커 대상 (체비쇼프 거리순 딜레이付き) */
export interface SpreadMark {
  r: number;
  c: number;
  delayMs: number;
}

export function spreadMarks(size: number, r: number, c: number): SpreadMark[] {
  const out: SpreadMark[] = [];
  for (let i = 0; i < size; i += 1) {
    if (i !== c) out.push({ r, c: i, delayMs: 60 * Math.abs(i - c) });
    if (i !== r) out.push({ r: i, c, delayMs: 60 * Math.abs(i - r) });
  }
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nc >= 0 && nr < size && nc < size) {
        out.push({ r: nr, c: nc, delayMs: 60 });
      }
    }
  }
  const seen = new Set<string>();
  return out.filter((m) => {
    const k = `${m.r},${m.c}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
