export type Pos = [number, number];

function adjacent(a: Pos, b: Pos): boolean {
  return Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1;
}

function cellsOf(islands: number[][], id: number): Pos[] {
  const out: Pos[] = [];
  islands.forEach((line, r) => {
    line.forEach((cell, c) => {
      if (cell === id) out.push([r, c]);
    });
  });
  return out;
}

/** 해를 최대 limit개까지 센다. limit=2면 유일해 확인용으로 2개째에서 멈춘다. */
export function countSolutions(islands: number[][], limit = 2): Pos[][] {
  const ids = [...new Set(islands.flat())].sort((a, b) => a - b);
  // 후보가 적은 섬부터 배치 (가지치기)
  const order = ids
    .map((id) => ({ id, cells: cellsOf(islands, id) }))
    .sort((a, b) => a.cells.length - b.cells.length);

  const results: Pos[][] = [];
  const rows = new Set<number>();
  const cols = new Set<number>();
  const placed: Pos[] = [];

  function dfs(k: number): void {
    if (results.length >= limit) return;
    if (k === order.length) {
      results.push(placed.map(([r, c]) => [r, c] as Pos));
      return;
    }
    for (const [r, c] of order[k].cells) {
      if (rows.has(r) || cols.has(c)) continue;
      if (placed.some((p) => adjacent(p, [r, c]))) continue;
      rows.add(r);
      cols.add(c);
      placed.push([r, c]);
      dfs(k + 1);
      placed.pop();
      cols.delete(c);
      rows.delete(r);
      if (results.length >= limit) return;
    }
  }

  dfs(0);
  return results;
}

/** 섬맵 구조 문제를 문자열 목록으로 반환한다. 빈 목록이면 정상. */
export function checkIslands(islands: number[][]): string[] {
  const problems: string[] = [];
  const size = islands.length;
  if (size === 0 || islands.some((line) => line.length !== size)) {
    problems.push('보드가 정사각이 아니다');
    return problems;
  }
  const ids = [...new Set(islands.flat())].sort((a, b) => a - b);
  if (ids.length !== size) problems.push(`섬 개수가 보드 크기와 다르다 (섬 ${ids.length}개, 보드 ${size})`);
  ids.forEach((id, i) => {
    if (id !== i) problems.push(`섬 id가 0부터 연속이 아니다 (발견: ${id}, 기대: ${i})`);
  });
  for (const id of ids) {
    const cells = cellsOf(islands, id);
    const seen = new Set<string>([`${cells[0][0]},${cells[0][1]}`]);
    const queue: Pos[] = [cells[0]];
    while (queue.length > 0) {
      const [r, c] = queue.pop() as Pos;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as Pos[]) {
        const key = `${r + dr},${c + dc}`;
        if (islands[r + dr]?.[c + dc] === id && !seen.has(key)) {
          seen.add(key);
          queue.push([r + dr, c + dc]);
        }
      }
    }
    if (seen.size !== cells.length) problems.push(`섬 ${id}이 직교 연속이 아니다`);
  }
  return problems;
}
