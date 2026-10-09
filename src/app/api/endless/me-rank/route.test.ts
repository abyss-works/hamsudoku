// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { getSessionUser } from '../../../../server/auth';
import { createPrismaDb } from '../../../../server/db';
import { rankStoreFromEnv } from '../../../../server/rank';

vi.mock('../../../../server/auth', () => ({
  getSessionUser: vi.fn(async () => ({ uid: 'u1', email: null })),
}));

vi.mock('../../../../server/db', () => ({
  createPrismaDb: vi.fn(() => ({
    lookupNicknames: vi.fn(async () => ({ u1: '햄찌' })),
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
  it('스냅샷을 거치지 않은 실시간 순위·점수·닉네임을 내린다', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ rank: 2, score: 52, nickname: '햄찌' });
  });

  it('세션이 없으면 401을 내린다', async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ uid: null, email: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('저장소가 없으면 빈 순위를 내린다', async () => {
    vi.mocked(rankStoreFromEnv).mockReturnValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ rank: null, score: 0, nickname: null });
  });

  it('닉네임이 없으면 null로 내린다', async () => {
    vi.mocked(createPrismaDb).mockReturnValueOnce({ lookupNicknames: vi.fn(async () => ({})) } as never);
    const res = await GET();
    expect(await res.json()).toEqual({ rank: 2, score: 52, nickname: null });
  });
});
