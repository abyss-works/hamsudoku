import type { CellState } from './puzzles';

/** 확정 정답마커가 우선하고, 덮인 조각은 일반 X로 렌더링한다. */
export function resolveMark(state: CellState, covered: boolean, confirmed = false): CellState {
  if (confirmed) return 'auto';
  return state === 'frag' && covered ? 'mark' : state;
}

/** 해당 앵커가 소유한 조각과 다른 앵커 아래의 임시 표시를 모은다. */
export function ownedProbeCells(
  ownersByCell: ReadonlyMap<string, ReadonlySet<string>>,
  cells: CellState[][],
  owner: string,
): string[] {
  const owned: string[] = [];
  for (const [key, owners] of ownersByCell) {
    if (!owners.has(owner)) continue;
    const [r, c] = key.split(',').map(Number);
    if (cells[r]?.[c] === 'frag' || cells[r]?.[c] === 'anchor') owned.push(key);
  }
  return owned;
}
