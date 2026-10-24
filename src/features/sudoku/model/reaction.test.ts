import { describe, expect, it } from 'vitest';
import { cellReaction, reactionTier, type Reaction } from './reaction';

describe('reactionTier', () => {
  it.each([
    [1, false, 1],
    [2, false, 2],
    [3, false, 2],
    [4, false, 3],
    [7, false, 3],
    [1, true, 3],
    [2, true, 3],
  ] as const)('연속 %i회, 판 완성 %s이면 단계 %i', (run, completed, tier) => {
    expect(reactionTier(run, completed)).toBe(tier);
  });
});

describe('cellReaction', () => {
  const correct = (tier: Reaction['tier']): Reaction => ({ kind: 'correct', tier, key: '1,2', seq: 5 });

  it('반응이 없거나 햄스터가 아닌 칸은 반응하지 않는다', () => {
    expect(cellReaction(null, '1,2', 'hamster')).toBeNull();
    expect(cellReaction(correct(1), '1,2', 'anchor')).toBeNull();
    expect(cellReaction({ kind: 'wrong', tier: 1, key: '0,0', seq: 2 }, '1,2', 'mark')).toBeNull();
  });

  it.each([
    [1, 'smile', 1],
    [2, 'smile', 2],
    [3, 'excited', 3],
  ] as const)('정답 단계 %i는 확정 칸에 %s 표정과 하트 %i개를 낸다', (tier, expression, hearts) => {
    expect(cellReaction(correct(tier), '1,2', 'hamster')).toEqual({ expression, hearts, seq: 5 });
  });

  it('정답 반응은 다른 햄스터 칸에 퍼지지 않는다', () => {
    expect(cellReaction(correct(3), '0,0', 'hamster')).toBeNull();
  });

  it('오답 반응은 모든 햄스터 칸을 하트 없이 놀라게 한다', () => {
    const wrong: Reaction = { kind: 'wrong', tier: 1, key: '4,4', seq: 9 };
    expect(cellReaction(wrong, '0,0', 'hamster')).toEqual({ expression: 'surprised', hearts: 0, seq: 9 });
    expect(cellReaction(wrong, '2,3', 'hamster')).toEqual({ expression: 'surprised', hearts: 0, seq: 9 });
  });
});
