import type { CellState } from './puzzles';

/** 확정 정답마커가 우선하고, 덮인 조각은 일반 X로 렌더링한다. */
export function resolveMark(state: CellState, covered: boolean, confirmed = false): CellState {
  if (confirmed) return 'auto';
  return state === 'frag' && covered ? 'mark' : state;
}

/** 주인이 맞고 아직 조각인 소유 조각만 모은다. 회수 대상이다. */
export function ownedFrags(
  links: ReadonlyMap<string, string>,
  cells: CellState[][],
  owner: string,
): string[] {
  const owned: string[] = [];
  for (const [frag, anchor] of links) {
    if (anchor !== owner) continue;
    const [r, c] = frag.split(',').map(Number);
    if (cells[r]?.[c] === 'frag') owned.push(frag);
  }
  return owned;
}
