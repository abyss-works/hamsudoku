// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

vi.mock('../../../../server/auth', () => ({
  getSessionUser: vi.fn(async () => ({ uid: 'u1', email: null })),
}));

vi.mock('../../../../server/db', () => ({
  createPrismaDb: vi.fn(() => ({
    lookupNicknames: vi.fn(async () => ({})),
  })),
}));

vi.mock('../../../../server/rank', () => ({
  rankStoreFromEnv: vi.fn(() => ({
    top: vi.fn(async () => ({ at: new Date().toISOString(), entries: [] })),
    rankOf: vi.fn(async () => ({ rank: null, score: 0 })),
    increment: vi.fn(async () => {}),
  })),
}));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('GET /api/endless/rank 마감 창', () => {
  it('마감 중에는 끝난 시즌의 확정 표를 마감 표시와 함께 내린다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T15:30:00Z'));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.season).toBe('2026-W40');
    expect(body.frozen).toBe(true);
  });

  it('창 밖에는 현재 시즌을 마감 해제 표시와 함께 내린다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T19:00:00Z'));
    const res = await GET();
    const body = await res.json();
    expect(body.season).toBe('2026-W41');
    expect(body.frozen).toBe(false);
  });
});
