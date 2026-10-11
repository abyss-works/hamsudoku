import { describe, expect, it } from 'vitest';
import { rankDialogService } from './rankDialogService';
import type { RankResponse } from '../../shared/endless';

describe('rankDialogService', () => {
  it('랭킹 데이터를 화면 표시용 모델로 변환한다', () => {
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
    const model = rankDialogService({ rank, myRank: null, uid: 'u2', signedIn: true });
    expect(model.season).toBe('2026-W41');
    expect(model.frozen).toBe(false);
    expect(model.rows).toHaveLength(2);
    expect(model.empty).toBe(false);
    expect(model.myRankSummary).toBe('내 순위: 2위 · 50개');
  });
});
