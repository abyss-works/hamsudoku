// 추론 솔버. 사람이 쓰는 기법을 비용 순으로 적용해 맵의 난이도를 잰다.
// 정답을 참조하지 않는 건전한 추론만 쓰며, React·DOM 의존이 없다.

export type Pos = readonly [number, number];
export type UnitType = 'isl' | 'row' | 'col';

export interface Unit {
  type: UnitType;
  k: number;
}

export interface State {
  n: number;
  islands: readonly number[][];
  cand: boolean[][];
  sat: { isl: Set<number>; row: Set<number>; col: Set<number> };
  placed: Pos[];
}

export interface Chain {
  k: number;
  len: number;
}

export interface Measure {
  size: number;
  tier: 0 | 1 | 2 | 3 | 4;
  t0: number;
  t1: number;
  t2: number;
  t3: number;
  t3Attempts: number;
  chains: Chain[];
  maxChain: number;
  score: number;
}

export type TraceStep =
  | { kind: 'place'; tier: 0; cell: Pos }
  | { kind: 'eliminate'; tier: 1 | 2 | 3; cell: Pos };

export const WEIGHTS = {
  version: 'w1',
  t1: 3,
  t2: 6,
  t3: 10,
  len: 2,
  k: 4,
} as const;

export function init(islands: readonly number[][]): State {
  const n = islands.length;
  return {
    n,
    islands,
    cand: Array.from({ length: n }, () => Array<boolean>(n).fill(true)),
    sat: { isl: new Set(), row: new Set(), col: new Set() },
    placed: [],
  };
}

export function clone(s: State): State {
  return {
    n: s.n,
    islands: s.islands,
    cand: s.cand.map((line) => [...line]),
    sat: { isl: new Set(s.sat.isl), row: new Set(s.sat.row), col: new Set(s.sat.col) },
    placed: [...s.placed],
  };
}

function inUnit(s: State, u: Unit, r: number, c: number): boolean {
  if (u.type === 'isl') return s.islands[r][c] === u.k;
  if (u.type === 'row') return r === u.k;
  return c === u.k;
}

export function cellsOf(s: State, u: Unit): Pos[] {
  const out: Pos[] = [];
  for (let r = 0; r < s.n; r += 1) {
    for (let c = 0; c < s.n; c += 1) {
      if (inUnit(s, u, r, c)) out.push([r, c]);
    }
  }
  return out;
}

export function candOf(s: State, u: Unit): Pos[] {
  return cellsOf(s, u).filter(([r, c]) => s.cand[r][c]);
}

export function isSat(s: State, u: Unit): boolean {
  return s.sat[u.type].has(u.k);
}

export function openUnits(s: State): Unit[] {
  const out: Unit[] = [];
  for (const type of ['isl', 'row', 'col'] as const) {
    for (let k = 0; k < s.n; k += 1) {
      if (!s.sat[type].has(k)) out.push({ type, k });
    }
  }
  return out;
}

export function place(s: State, [r, c]: Pos): void {
  const id = s.islands[r][c];
  s.placed.push([r, c]);
  s.sat.isl.add(id);
  s.sat.row.add(r);
  s.sat.col.add(c);
  for (let i = 0; i < s.n; i += 1) {
    for (let j = 0; j < s.n; j += 1) {
      if (i === r && j === c) continue;
      if (i === r || j === c || s.islands[i][j] === id || Math.max(Math.abs(i - r), Math.abs(j - c)) <= 1) {
        s.cand[i][j] = false;
      }
    }
  }
  s.cand[r][c] = false;
}

export function eliminate(s: State, [r, c]: Pos): void {
  s.cand[r][c] = false;
}

export function hasContradiction(s: State): boolean {
  return openUnits(s).some((u) => candOf(s, u).length === 0);
}

export function isSolved(s: State): boolean {
  return s.placed.length === s.n;
}

/** T0: 후보가 하나뿐인 열린 유닛에 배치한다. 적용한 칸을 돌려주고 없으면 null. */
export function findT0(s: State): Pos | null {
  for (const u of openUnits(s)) {
    const cand = candOf(s, u);
    if (cand.length === 1) return cand[0];
  }
  return null;
}

export function applyT0Once(s: State): boolean {
  const x = findT0(s);
  if (!x) return false;
  place(s, x);
  return true;
}

/** T1: 유닛 A 의 후보가 다른 종류의 유닛 B 안에 갇히면 B 의 나머지 후보를 소거한다. */
export function findT1(s: State): Pos[] | null {
  const open = openUnits(s);
  for (const a of open) {
    const candA = candOf(s, a);
    if (candA.length === 0) continue;
    for (const b of open) {
      if (a.type === b.type) continue;
      if (!candA.every(([r, c]) => inUnit(s, b, r, c))) continue;
      const rest = candOf(s, b).filter(([r, c]) => !inUnit(s, a, r, c));
      if (rest.length > 0) return rest;
    }
  }
  return null;
}

export function applyT1Once(s: State): boolean {
  const rest = findT1(s);
  if (!rest) return false;
  for (const x of rest) eliminate(s, x);
  return true;
}

export interface HypoResult {
  contradiction: boolean;
  len: number;
}

export function hypothesize(s: State, x: Pos, propagate: boolean): HypoResult {
  const t = clone(s);
  place(t, x);
  if (hasContradiction(t)) return { contradiction: true, len: 0 };
  if (!propagate) return { contradiction: false, len: 0 };
  let len = 0;
  for (;;) {
    const progressed = applyT0Once(t) || applyT1Once(t);
    if (!progressed) return { contradiction: false, len };
    len += 1;
    if (hasContradiction(t)) return { contradiction: true, len };
  }
}

const TYPE_ORDER: Record<UnitType, number> = { isl: 0, row: 1, col: 2 };

export function hypothesisOrder(s: State): { x: Pos; k: number }[] {
  const units = openUnits(s)
    .map((u) => ({ u, cand: candOf(s, u) }))
    .filter(({ cand }) => cand.length >= 2)
    .sort(
      (a, b) =>
        a.cand.length - b.cand.length ||
        TYPE_ORDER[a.u.type] - TYPE_ORDER[b.u.type] ||
        a.u.k - b.u.k,
    );
  const seen = new Set<string>();
  const out: { x: Pos; k: number }[] = [];
  for (const { cand } of units) {
    for (const x of cand) {
      const key = `${x[0]},${x[1]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ x, k: cand.length });
    }
  }
  return out;
}

export function score(m: Measure): number {
  if (m.tier === 4) return Infinity;
  return (
    WEIGHTS.t1 * m.t1 +
    WEIGHTS.t2 * m.t2 +
    m.chains.reduce((acc, c) => acc + WEIGHTS.t3 + WEIGHTS.len * c.len + WEIGHTS.k * (c.k - 2), 0)
  );
}

export function measureWithTrace(islands: readonly number[][]): { measure: Measure; trace: TraceStep[] } {
  const s = init(islands);
  const trace: TraceStep[] = [];
  const m: Measure = {
    size: islands.length,
    tier: 0,
    t0: 0,
    t1: 0,
    t2: 0,
    t3: 0,
    t3Attempts: 0,
    chains: [],
    maxChain: 0,
    score: 0,
  };
  const bump = (tier: 1 | 2 | 3) => {
    if (tier > m.tier) m.tier = tier;
  };
  while (!isSolved(s)) {
    if (hasContradiction(s)) {
      m.tier = 4;
      break;
    }
    const t0 = findT0(s);
    if (t0) {
      place(s, t0);
      m.t0 += 1;
      trace.push({ kind: 'place', tier: 0, cell: t0 });
      continue;
    }
    const t1 = findT1(s);
    if (t1) {
      for (const x of t1) {
        eliminate(s, x);
        trace.push({ kind: 'eliminate', tier: 1, cell: x });
      }
      m.t1 += 1;
      bump(1);
      continue;
    }
    const order = hypothesisOrder(s);
    let done = false;
    for (const { x } of order) {
      if (hypothesize(s, x, false).contradiction) {
        eliminate(s, x);
        trace.push({ kind: 'eliminate', tier: 2, cell: x });
        m.t2 += 1;
        bump(2);
        done = true;
        break;
      }
    }
    if (done) continue;
    for (const { x, k } of order) {
      m.t3Attempts += 1;
      const r = hypothesize(s, x, true);
      if (r.contradiction) {
        eliminate(s, x);
        trace.push({ kind: 'eliminate', tier: 3, cell: x });
        m.t3 += 1;
        m.chains.push({ k, len: r.len });
        bump(3);
        done = true;
        break;
      }
    }
    if (done) continue;
    m.tier = 4;
    break;
  }
  m.maxChain = m.chains.reduce((acc, c) => Math.max(acc, c.len), 0);
  m.score = score(m);
  return { measure: m, trace };
}

export function measure(islands: readonly number[][]): Measure {
  return measureWithTrace(islands).measure;
}
