import { describe, expect, it } from 'vitest';
import { adminRankModel, rankModel } from './rankLogic';
import type { RankResponse } from '../../shared/endless';

describe('rankLogic pure view models', () => {
  it('랭킹 다이얼로그 뷰 모델을 완전하게 구성하고 게스트 이름/순위 1부터/0점/빈 목록을 보존한다', () => {
    const rank: RankResponse = {
      season: '2026-W41',
      snapshotAt: '2026-10-10T00:00:00Z',
      frozen: false,
      top: [
        { userId: 'u1', nickname: '햄찌', score: 100 },
        { userId: 'u2', nickname: null, score: 50 },
      ],
      me: { rank: 2, score: 50 },
    };
    const vm = rankModel(rank, null, 'u2', true);
    expect(vm.season).toBe('2026-W41');
    expect(vm.frozen).toBe(false);
    expect(vm.empty).toBe(false);
    expect(vm.rows).toEqual([
      { userId: 'u1', rankNo: 1, displayName: '햄찌', score: 100, isMe: false },
      { userId: 'u2', rankNo: 2, displayName: '게스트', score: 50, isMe: true },
    ]);
    expect(vm.myRankSummary).toBe('내 순위: 2위 · 50개');
  });

  it('기록 없음, 로그인 안됨, 0점 및 순위 없음 문구를 보존한다', () => {
    // 1. 비로그인: 내 순위 요약 없음
    const rankGuest: RankResponse = {
      season: '2026-W41',
      snapshotAt: '2026-10-10T00:00:00Z',
      frozen: true,
      top: [],
      me: { rank: null, score: 0 },
    };
    const vmGuest = rankModel(rankGuest, null, null, false);
    expect(vmGuest.frozen).toBe(true);
    expect(vmGuest.empty).toBe(true);
    expect(vmGuest.myRankSummary).toBeNull();

    // 2. 로그인 상태지만 내 순위 없음 + 점수 0점
    const rankNoRank: RankResponse = {
      season: '2026-W41',
      snapshotAt: '2026-10-10T00:00:00Z',
      frozen: false,
      top: [],
      me: { rank: null, score: 0 },
    };
    const vmNoRank = rankModel(rankNoRank, null, 'u3', true);
    expect(vmNoRank.myRankSummary).toBe('내 순위: 아직 없음 · 0개');

    // 3. rank 데이터가 아예 없는 경우
    const vmNull = rankModel(null, null, null, false);
    expect(vmNull.empty).toBe(false);
    expect(vmNull.myRankSummary).toBeNull();
    expect(vmNull.rows).toEqual([]);
  });

  it('관리자 랭킹 패널 뷰 모델을 구성한다', () => {
    const entries = [
      { userId: '1234567890', nickname: null, score: 20 },
      { userId: 'abcdefghijkl', nickname: '유저', score: 30 },
    ];
    const guestEntries = [{ userId: '1234567890', nickname: null, score: 20 }];

    // 선택 없음
    const emptySel = adminRankModel(entries, guestEntries, []);
    expect(emptySel.summaryText).toBe('전체 2건 · 게스트 1건 — 게스트만 기본 목록이에요.');
    expect(emptySel.empty).toBe(false);
    expect(emptySel.canRemove).toBe(false);
    expect(emptySel.removeLabel).toBe('선택 후 삭제');
    expect(emptySel.rows).toEqual([
      {
        userId: '1234567890',
        shortId: '12345678…',
        score: 20,
        selected: false,
        toggleLabel: '1234567890 선택',
      },
    ]);

    // 선택 있음
    const sel = adminRankModel(entries, guestEntries, ['1234567890']);
    expect(sel.canRemove).toBe(true);
    expect(sel.removeLabel).toBe('1건 제거');
    expect(sel.rows[0].selected).toBe(true);

    // 게스트 없음
    const noGuest = adminRankModel(entries, [], []);
    expect(noGuest.empty).toBe(true);
    expect(noGuest.rows).toEqual([]);
  });
});
