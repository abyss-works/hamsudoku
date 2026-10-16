import { describe, expect, it } from 'vitest';
import { stageStatsTarget } from './rules';

const base = {
  stageId: 'e-1',
  plays: 0,
  clears: 0,
  clearTotalMs: BigInt(0),
  avgClearMs: 0,
  totalAttempts: 3,
  clearedUserCount: 2,
  verifiedClearCount: 2,
  verifiedClearTotalMs: BigInt(20001),
};

describe('stageStatsTarget', () => {
  it('진행 기록 시도 수와 검증 이벤트로 목표 통계를 만들고 평균을 정수로 내림한다', () => {
    expect(stageStatsTarget(base)).toEqual({
      ok: true,
      target: { plays: 3, clears: 2, clearTotalMs: BigInt(20001), avgClearMs: 10000 },
    });
  });

  it('클리어가 없으면 평균은 0이다', () => {
    expect(
      stageStatsTarget({ ...base, clearedUserCount: 0, verifiedClearCount: 0, verifiedClearTotalMs: BigInt(0) }),
    ).toEqual({ ok: true, target: { plays: 3, clears: 0, clearTotalMs: BigInt(0), avgClearMs: 0 } });
  });

  it.each([
    ['클리어한 사용자는 있는데 검증 이벤트가 없으면', { verifiedClearCount: 0, verifiedClearTotalMs: BigInt(0) }, 'without verified clear events'],
    ['클리어한 사용자가 검증 이벤트보다 많으면', { clearedUserCount: 3 }, 'exceeds verified clear events'],
    ['시도 수가 검증 이벤트보다 적으면', { totalAttempts: 1 }, 'is less than verified clear count'],
  ])('%s 보정하지 않고 불일치를 보고한다', (_label, override, message) => {
    const result = stageStatsTarget({ ...base, ...override });
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).toContain('Stage e-1');
    expect(result.ok ? '' : result.error).toContain(message);
  });
});
