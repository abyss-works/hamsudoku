import type { CellState } from './puzzles';

/** 덮인 조각은 X로 본다. 렌더·확정·스트로크 시작이 공유하는 우선순위다. */
export function resolveMark(state: CellState, covered: boolean): CellState {
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
