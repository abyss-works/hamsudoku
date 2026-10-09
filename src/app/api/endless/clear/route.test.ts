// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
import { submitEndlessClear } from '../../../../server/endless';
import { rankStoreFromEnv } from '../../../../server/rank';

vi.mock('../../../../server/auth', () => ({
  getSessionUser: vi.fn(async () => ({ uid: 'u1', email: null })),
}));

vi.mock('../../../../server/db', () => ({
  createPrismaDb: vi.fn(() => ({})),
}));

vi.mock('../../../../server/endless', () => ({
  submitEndlessClear: vi.fn(async () => ({
    status: 200,
    body: { ok: true, earned: 2, balance: 10, streak: { current: 1, best: 1 }, suspicious: false },
  })),
}));

vi.mock('../../../../server/rank', () => ({
  rankStoreFromEnv: vi.fn(() => ({
    increment: vi.fn(async () => {}),
  })),
}));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const req = () =>
  new Request('http://localhost/api/endless/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attemptKey: 'k1', stageId: 's1', solution: [[0, 0]], seedLeft: 2 }),
  });

const storeOf = () => {
  const store = vi.mocked(rankStoreFromEnv).mock.results[0]?.value as { increment: ReturnType<typeof vi.fn> };
  return store.increment;
};

describe('POST /api/endless/clear 마감 창', () => {
  it('마감 중 클리어는 지갑 적립만 하고 랭킹 적립은 멈춘다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T15:30:00Z'));
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(storeOf()).not.toHaveBeenCalled();
  });

  it('창 밖 클리어는 랭킹에 적립한다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T19:00:00Z'));
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(storeOf()).toHaveBeenCalledTimes(1);
  });
});
