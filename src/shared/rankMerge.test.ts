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
    frozen: false,
    status: 'active',
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

  it('별도 조회 값이 있으면 스냅샷 대신 그 점수·닉네임으로 그린다', () => {
    const r = rankResponse({
      top: [
        { userId: 'u1', nickname: '햄찌', score: 60 },
        { userId: 'me', nickname: '옛이름', score: 47 },
        { userId: 'u3', nickname: '토끼', score: 30 },
      ],
      me: { rank: 2, score: 47 },
    });
    const { entries, meRank } = mergeRankEntries(r, 'me', { score: 55, nickname: '새이름' });
    expect(entries.filter((e) => e.userId === 'me')).toHaveLength(1);
    expect(entries.map((e) => e.userId)).toEqual(['u1', 'me', 'u3']);
    expect(entries[1].score).toBe(55);
    expect(entries[1].nickname).toBe('새이름');
    expect(meRank).toBe(2);
  });

  it('동점: 점수가 같으면 userId 내림차순으로 정렬한다', () => {
    const r = rankResponse({
      top: [
        { userId: 'user-b', nickname: 'B', score: 50 },
        { userId: 'user-a', nickname: 'A', score: 50 },
      ],
      me: { rank: null, score: 0 },
    });
    // 내 userId: 'user-ab' (user-b > user-ab > user-a)
    const { entries: resMid } = mergeRankEntries(r, 'user-ab', { score: 50, nickname: 'AB' });
    expect(resMid.map((e) => e.userId)).toEqual(['user-b', 'user-ab', 'user-a']);

    // 내 userId: 'user-z' (user-z > user-b)
    const { entries: resHigh } = mergeRankEntries(r, 'user-z', { score: 50, nickname: 'Z' });
    expect(resHigh.map((e) => e.userId)).toEqual(['user-z', 'user-b', 'user-a']);
  });

  it('상위 50명 밖 개인: 목록이 50명 이상이고 내 점수가 미달하면 목록 뒤에 51위로 끼우지 않는다', () => {
    const top50 = Array.from({ length: 50 }, (_, i) => ({
      userId: `top-${String(i + 1).padStart(2, '0')}`,
      nickname: null,
      score: 100 - i, // 100부터 51까지
    }));
    const r = rankResponse({ top: top50, me: { rank: 150, score: 10 } });
    const { entries, meRank } = mergeRankEntries(r, 'me', { score: 10, nickname: '나' });

    // 50명 초과로 51번째 항목을 만들지 않는다
    expect(entries).toHaveLength(50);
    expect(entries.find((e) => e.userId === 'me')).toBeUndefined();
    // 전체 개인 순위를 목록 위치(51위 등)로 추측하지 않고 서버의 순위(150위)를 보존한다
    expect(meRank).toBe(150);
  });

  it('목록 내 동일 userId 중복이 있으면 1건으로 합친다', () => {
    const r = rankResponse({
      top: [
        { userId: 'dup', nickname: 'D1', score: 60 },
        { userId: 'dup', nickname: 'D2', score: 55 },
        { userId: 'other', nickname: null, score: 40 },
      ],
      me: { rank: 3, score: 10 },
    });
    const { entries } = mergeRankEntries(r, 'me');
    expect(entries.filter((e) => e.userId === 'dup')).toHaveLength(1);
  });
});

