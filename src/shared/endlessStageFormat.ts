export function serializeRegions(islands: number[][]): string {
  return islands.flat().join('');
}

export function serializeSolution(spots: [number, number][]): string {
  return spots.map(([r, c]) => `${r},${c}`).join(';');
}

export function stageId(seed: number, index: number): string {
  return `e-${seed}-${index}`;
}
