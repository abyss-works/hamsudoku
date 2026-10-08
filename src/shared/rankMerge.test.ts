import { describe, expect, it } from 'vitest';
import { mergeRankEntries } from './rankMerge';
import type { RankResponse } from './endless';

function rankResponse(over: Partial<RankResponse> = {}): RankResponse {
  return {
    season: '2026-W41',
    top: [
      { userId: 'u1', nickname: '햄찌', score: 60 },
      { userId: 'u2', nickname: null, score: 51 },
      { userId: 'u3', nickname: '토끼', score: 47 },
    ],
    snapshotAt: '2026-10-07T00:00:00.000Z',
    me: { rank: 3, score: 47 },
    ...over,
  };
}

describe('mergeRankEntries', () => {
  it('내 실시간 점수를 스냅샷에 끼워넣어 순위를 다시 계산한다', () => {
    const r = rankResponse({ me: { rank: 3, score: 52 } });
    const { entries, meRank } = mergeRankEntries(r, 'me');
    // 60(1위), 52(나), 51, 47 — 나보다 높은 점수 뒤, 낮은 점수 앞
    expect(entries.map((e) => e.userId)).toEqual(['u1', 'me', 'u2', 'u3']);
    expect(meRank).toBe(2);
    expect(entries[1].score).toBe(52);
  });

  it('스냅샷에 내 행이 있으면 제거하고 실시간 값 하나로 합친다', () => {
    const r = rankResponse({
      top: [
        { userId: 'u1', nickname: '햄찌', score: 60 },
        { userId: 'me', nickname: '나', score: 47 },
        { userId: 'u3', nickname: '토끼', score: 30 },
      ],
      me: { rank: 2, score: 52 },
    });
    const { entries, meRank } = mergeRankEntries(r, 'me');
    expect(entries.filter((e) => e.userId === 'me')).toHaveLength(1);
    expect(entries.map((e) => e.userId)).toEqual(['u1', 'me', 'u3']);
    expect(meRank).toBe(2);
    expect(entries[1].score).toBe(52);
  });

  it('내 점수가 모두보다 낮으면 맨 뒤에 둔다', () => {
    const r = rankResponse({ me: { rank: 4, score: 10 } });
    const { entries, meRank } = mergeRankEntries(r, 'me');
    expect(entries[entries.length - 1].userId).toBe('me');
    expect(meRank).toBe(4);
  });

  it('내 점수가 모두보다 높으면 1위에 둔다', () => {
    const r = rankResponse({ me: { rank: 2, score: 99 } });
    const { entries, meRank } = mergeRankEntries(r, 'me');
    expect(entries[0].userId).toBe('me');
    expect(meRank).toBe(1);
  });
});
