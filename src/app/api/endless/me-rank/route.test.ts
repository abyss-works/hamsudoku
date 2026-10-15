// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { getSessionUser } from '../../../../server/auth';
import { createPrismaDb } from '../../../../server/db/prisma';
import { rankStoreFromEnv } from '../../../../server/rank';

vi.mock('../../../../server/auth', () => ({
  getSessionUser: vi.fn(async () => ({ uid: 'u1', email: null })),
}));

vi.mock('../../../../server/db/prisma', () => ({
  createPrismaDb: vi.fn(() => ({
    getSeasonFinalization: vi.fn(async () => null),
    getFinalizedUserRank: vi.fn(async () => null),
    getUserSeasonRank: vi.fn(async () => ({ rank: 2, score: 52 })),
    lookupNicknames: vi.fn(async () => ({ u1: '햄찌' })),
    getNickname: vi.fn(async () => '햄찌'),
  })),
}));

vi.mock('../../../../server/rank', () => ({
  rankStoreFromEnv: vi.fn(() => ({
    rankOf: vi.fn(async () => ({ rank: 2, score: 52 })),
  })),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/endless/me-rank', () => {
  it('스냅샷을 거치지 않은 실시간 순위·점수·닉네임 및 season을 내린다', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      season: expect.any(String),
      rank: 2,
      score: 52,
      nickname: '햄찌',
    });
  });

  it('세션이 없으면 401을 내린다', async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ uid: null, email: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('Redis 미설정 상태여도 DB에서 순위를 정상 조회한다', async () => {
    vi.mocked(rankStoreFromEnv).mockReturnValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      season: expect.any(String),
      rank: 2,
      score: 52,
      nickname: '햄찌',
    });
  });

  it('닉네임이 없으면 null로 내린다', async () => {
    vi.mocked(createPrismaDb).mockReturnValueOnce({
      getSeasonFinalization: vi.fn(async () => null),
      getFinalizedUserRank: vi.fn(async () => null),
      getUserSeasonRank: vi.fn(async () => ({ rank: 2, score: 52 })),
      lookupNicknames: vi.fn(async () => ({})),
      getNickname: vi.fn(async () => null),
    } as never);
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({
      season: expect.any(String),
      rank: 2,
      score: 52,
      nickname: null,
    });
  });
});
