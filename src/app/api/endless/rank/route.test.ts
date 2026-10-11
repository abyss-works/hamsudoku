// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

vi.mock('../../../../server/auth', () => ({
  getSessionUser: vi.fn(async () => ({ uid: 'u1', email: null })),
}));

let enqueuedSeason: string | null = null;
let enqueueResult: Promise<{ messageId: string }> | null = null;
vi.mock('../../../../server/qstashPublisher', () => ({
  createQStashPublisher: () => ({
    enqueueFinalize: async (season: string) => {
      enqueuedSeason = season;
      return enqueueResult ?? { messageId: 'msg-test' };
    },
  }),
}));

vi.mock('../../../../server/db', () => ({
  createPrismaDb: vi.fn(() => ({
    getSeasonFinalization: vi.fn(async () => null),
    getFinalizedSeasonTop: vi.fn(async (season: string) => {
      if (season === '2026-W40') {
        return {
          header: { season: '2026-W40', startAt: '', endAt: '', finalizedAt: '2026-10-04T15:00:00Z', status: 'finalized' },
          results: [{ season: '2026-W40', userId: 'u1', score: 50, rank: 1 }],
        };
      }
      return null;
    }),
    getFinalizedUserRank: vi.fn(async (season: string, userId: string) => {
      if (season === '2026-W40' && userId === 'u1') {
        return { rank: 1, score: 50 };
      }
      return null;
    }),
    getUserSeasonRank: vi.fn(async () => ({ rank: 1, score: 50 })),
    listSeasonEarnings: vi.fn(async () => [{ userId: 'u1', amount: 50 }]),
    lookupNicknames: vi.fn(async () => ({ u1: '햄찌' })),
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
  enqueuedSeason = null;
  enqueueResult = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('GET /api/endless/rank 마감 창 및 확정 상태', () => {
  it('미확정 시즌 보완 큐의 등록 응답이 도착한 뒤 조회 응답을 완료한다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T15:30:00Z'));
    let acknowledge!: (value: { messageId: string }) => void;
    enqueueResult = new Promise((resolve) => { acknowledge = resolve; });
    let responded = false;
    const pending = GET().then((res) => { responded = true; return res; });
    await vi.waitFor(() => expect(enqueuedSeason).toBe('2026-W41'));
    expect(responded).toBe(false);
    acknowledge({ messageId: 'acknowledged' });
    expect((await pending).status).toBe(200);
  });

  it('큐 등록 실패는 관측하고 미확정 조회를 집계 중 상태로 유지한다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T15:30:00Z'));
    enqueueResult = Promise.reject(new Error('publish failed'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await GET();
    expect((await res.json()).status).toBe('aggregating');
    expect(warn).toHaveBeenCalledWith('Ranking finalization enqueue failed');
  });
  it('마감 중 확정된 시즌은 확정 결과를 status: finalized로 반환한다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T15:30:00Z')); // 2026-W40 마감 창 (확정된 상태)
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.season).toBe('2026-W40');
    expect(body.frozen).toBe(true);
    expect(body.status).toBe('finalized');
    expect(body.top).toEqual([{ userId: 'u1', nickname: '햄찌', score: 50 }]);
  });

  it('마감 창이지만 미확정 상태인 경우 status: aggregating 및 QStash enqueue를 수행한다', async () => {
    vi.useFakeTimers();
    // 2026-10-11 15:30:00 UTC = 2026-10-12 00:30 KST (2026-W41 마감 창, 미확정)
    vi.setSystemTime(new Date('2026-10-11T15:30:00Z'));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.season).toBe('2026-W41');
    expect(body.frozen).toBe(true);
    expect(body.status).toBe('aggregating');
    expect(body.top).toEqual([]);
    expect(enqueuedSeason).toBe('2026-W41');
  });

  it('창 밖에는 현재 시즌을 status: active로 반환한다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T19:00:00Z')); // 2026-W41 활성 기간
    const res = await GET();
    const body = await res.json();
    expect(body.season).toBe('2026-W41');
    expect(body.frozen).toBe(false);
    expect(body.status).toBe('active');
  });
});
