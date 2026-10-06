import { describe, expect, it } from 'vitest';
import {
  applyT0Once,
  applyT1Once,
  candOf,
  eliminate,
  hasContradiction,
  hypothesisOrder,
  hypothesize,
  init,
  measure,
  measureWithTrace,
  place,
  score,
  WEIGHTS,
  type Measure,
} from './logic';

// 고정 보드: 일자섬(길이 2)이 있어 T1이 걸리는 5x5
const BOARD_T1 = [
  [0, 0, 1, 1, 1],
  [2, 2, 1, 1, 1],
  [2, 2, 1, 1, 1],
  [3, 3, 3, 4, 4],
  [3, 3, 3, 4, 4],
];

// 생성 산출물에서 가져온 고정 보드 (이전 측정에서 tier 0·1·2 로 분류된 맵)
const MAP_T0 = {
  islands: [[2, 2, 2, 1, 0], [2, 1, 1, 1, 1], [2, 1, 1, 1, 1], [2, 1, 1, 3, 1], [4, 4, 4, 4, 4]],
  solution: [[0, 4], [1, 2], [2, 0], [3, 3], [4, 1]] as [number, number][],
};
const MAP_T1 = {
  islands: [[1, 1, 1, 0, 2], [1, 1, 1, 0, 2], [4, 4, 4, 4, 2], [3, 4, 4, 4, 4], [4, 4, 4, 4, 4]],
  solution: [[0, 3], [1, 1], [2, 4], [3, 0], [4, 2]] as [number, number][],
};
const MAP_T2 = {
  islands: [[0, 0, 0, 0, 0], [0, 1, 1, 1, 3], [0, 2, 2, 3, 3], [0, 0, 0, 3, 3], [4, 4, 4, 4, 3]],
  solution: [[0, 0], [1, 3], [2, 1], [3, 4], [4, 2]] as [number, number][],
};
// 해가 둘 이상이라 건전한 추론만으로는 끝나지 않는 보드
const MAP_MULTI = [
  [0, 0, 1, 1, 1],
  [0, 0, 1, 1, 1],
  [2, 2, 2, 3, 3],
  [2, 2, 2, 3, 3],
  [4, 4, 4, 4, 4],
];

const key = (p: readonly [number, number]) => `${p[0]},${p[1]}`;

describe('상태 모델', () => {
  it('init 은 전 칸을 후보로 두고 배치가 없다', () => {
    const s = init(BOARD_T1);
    expect(s.placed).toEqual([]);
    expect(s.cand.flat().every(Boolean)).toBe(true);
    expect(candOf(s, { type: 'isl', k: 0 }).map(key)).toEqual(['0,0', '0,1']);
  });

  it('place 는 같은 행·열·섬과 8이웃을 소거하고 유닛을 충족으로 표시한다', () => {
    const s = init(BOARD_T1);
    place(s, [1, 0]);
    expect(s.placed).toEqual([[1, 0]]);
    expect(s.sat.isl.has(2) && s.sat.row.has(1) && s.sat.col.has(0)).toBe(true);
    // 행 1, 열 0, 섬 2, 이웃
    for (const p of [[1, 1], [1, 4], [0, 0], [4, 0], [2, 1], [0, 1]] as const) {
      expect(s.cand[p[0]][p[1]]).toBe(false);
    }
    // 영향 밖
    expect(s.cand[0][2]).toBe(true);
    expect(s.cand[3][3]).toBe(true);
  });

  it('hasContradiction 은 열린 유닛의 후보가 비면 참이다', () => {
    const s = init(BOARD_T1);
    expect(hasContradiction(s)).toBe(false);
    eliminate(s, [0, 0]);
    eliminate(s, [0, 1]);
    expect(hasContradiction(s)).toBe(true);
  });
});

describe('T0 단일 후보', () => {
  it('후보가 하나뿐인 유닛에 배치한다', () => {
    const s = init(BOARD_T1);
    eliminate(s, [0, 1]);
    expect(applyT0Once(s)).toBe(true);
    expect(s.placed).toEqual([[0, 0]]);
  });

  it('해당 유닛이 없으면 거짓이다', () => {
    const s = init(BOARD_T1);
    expect(applyT0Once(s)).toBe(false);
    expect(s.placed).toEqual([]);
  });
});

describe('T1 잠긴 후보', () => {
  it('섬의 후보가 한 행에 갇히면 그 행의 나머지 칸을 소거한다', () => {
    const s = init(BOARD_T1);
    expect(applyT1Once(s)).toBe(true);
    expect(s.cand[0]).toEqual([true, true, false, false, false]);
    expect(s.placed).toEqual([]);
  });

  it('해당 쌍이 없으면 거짓이다', () => {
    const s = init(MAP_MULTI);
    expect(applyT1Once(s)).toBe(false);
  });
});

function prepared() {
  // isl2 후보 {(1,0),(2,1)}, isl3 후보 {(3,0),(4,2)}, isl4 에서 (3,4) 제거
  const s = init(BOARD_T1);
  for (const p of [[1, 1], [2, 0], [3, 1], [3, 2], [4, 0], [4, 1], [3, 4]] as const) eliminate(s, p);
  return s;
}

describe('가정 연산', () => {
  it('hypothesisOrder 는 후보 수 오름차순, 종류, 번호 순이며 같은 칸은 처음 것만 남긴다', () => {
    const order = hypothesisOrder(prepared()).map(({ x, k }) => `${key(x)}:${k}`);
    expect(order.slice(0, 9)).toEqual([
      '0,0:2', '0,1:2', '1,0:2', '2,1:2', '3,0:2', '4,2:2', '3,3:2', '4,3:3', '4,4:3',
    ]);
    expect(new Set(order).size).toBe(order.length);
  });

  it('전파 없이는 즉시 모순만 본다', () => {
    expect(hypothesize(prepared(), [0, 0], false)).toEqual({ contradiction: false, len: 0 });
  });

  it('전파하면 T0 연쇄 두 단계 뒤의 모순을 찾고 길이를 센다', () => {
    expect(hypothesize(prepared(), [0, 0], true)).toEqual({ contradiction: true, len: 2 });
  });

  it('원본 상태를 바꾸지 않는다', () => {
    const s = prepared();
    const before = JSON.stringify(s.cand);
    hypothesize(s, [0, 0], true);
    expect(JSON.stringify(s.cand)).toBe(before);
    expect(s.placed).toEqual([]);
  });
});

describe('measure', () => {
  it('단일 후보만으로 풀리는 맵은 tier 0, 점수 0 이다', () => {
    const m = measure(MAP_T0.islands);
    expect(m).toMatchObject({ size: 5, tier: 0, t0: 5, t1: 0, t2: 0, t3: 0, maxChain: 0, score: 0 });
  });

  it('잠긴 후보가 필요한 맵은 tier 1 이다', () => {
    const m = measure(MAP_T1.islands);
    expect(m.tier).toBe(1);
    expect(m.t1).toBeGreaterThan(0);
    expect(m.t2).toBe(0);
  });

  it('즉시 모순이 필요한 맵은 tier 2 이다', () => {
    const m = measure(MAP_T2.islands);
    expect(m.tier).toBe(2);
    expect(m.t2).toBeGreaterThan(0);
    expect(m.t3).toBe(0);
  });

  it('해가 둘 이상인 맵은 tier 4 로 끝나고 점수는 Infinity 다', () => {
    const m = measure(MAP_MULTI);
    expect(m.tier).toBe(4);
    expect(m.score).toBe(Infinity);
  });

  it('같은 입력은 같은 결과를 낸다', () => {
    expect(measure(MAP_T2.islands)).toEqual(measure(MAP_T2.islands));
  });

  it('소거한 칸은 정답에 속하지 않고 배치는 정답과 일치한다', () => {
    for (const map of [MAP_T0, MAP_T1, MAP_T2]) {
      const { measure: m, trace } = measureWithTrace(map.islands);
      const sol = new Set(map.solution.map(key));
      expect(m.tier).toBeLessThan(4);
      const placed = trace.filter((t) => t.kind === 'place').map((t) => key(t.cell));
      const eliminated = trace.filter((t) => t.kind === 'eliminate').map((t) => key(t.cell));
      expect(new Set(placed)).toEqual(sol);
      expect(eliminated.some((c) => sol.has(c))).toBe(false);
    }
  });
});

describe('score', () => {
  const base: Measure = {
    size: 5, tier: 0, t0: 5, t1: 0, t2: 0, t3: 0, t3Attempts: 0, chains: [], maxChain: 0, score: 0,
  };
  it('T1 하나 < T2 하나 < T3(길이 1) 하나 순으로 비싸다', () => {
    const s1 = score({ ...base, tier: 1, t1: 1 });
    const s2 = score({ ...base, tier: 2, t2: 1 });
    const s3 = score({ ...base, tier: 3, t3: 1, chains: [{ k: 2, len: 1 }], maxChain: 1 });
    expect(s1).toBeLessThan(s2);
    expect(s2).toBeLessThan(s3);
  });
  it('T3 는 전파가 길수록, 가정 유닛이 클수록 비싸다', () => {
    const a = score({ ...base, tier: 3, t3: 1, chains: [{ k: 2, len: 1 }], maxChain: 1 });
    const b = score({ ...base, tier: 3, t3: 1, chains: [{ k: 2, len: 3 }], maxChain: 3 });
    const c = score({ ...base, tier: 3, t3: 1, chains: [{ k: 4, len: 1 }], maxChain: 1 });
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(a);
    expect(WEIGHTS.version).toMatch(/^w\d+$/);
  });
});
