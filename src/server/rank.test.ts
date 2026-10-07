import { describe, expect, it } from 'vitest';
import { createMemoryDb } from './db';
import { createRankStore, rankStoreFromEnv, rebuildFromLedger } from './rank';

type Call = { url: string; init: RequestInit };

function makeStore(replies: unknown[], calls: Call[]) {
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return Response.json({ result: replies.shift() ?? null });
  }) as typeof fetch;
  return createRankStore({ url: 'https://example.upstash.io', token: 'tok', fetchImpl });
}

describe('createRankStore', () => {
  it('increment는 ZINCRBY를 보낸다', async () => {
    const calls: Call[] = [];
    const store = makeStore([7], calls);
    await store.increment('2026-W41', 'u1', 3);
    expect(calls[0].url).toBe('https://example.upstash.io');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(String(calls[0].init.body))).toEqual(['zincrby', 'rank:2026-W41', 3, 'u1']);
  });

  it('top은 스냅샷이 없으면 만들고 저장한다', async () => {
    const calls: Call[] = [];
    const store = makeStore([null, ['u1', 9, 'u2', 4], 'OK'], calls);
    const snap = await store.top('2026-W41', 2);
    expect(snap.entries).toEqual([{ userId: 'u1', score: 9 }, { userId: 'u2', score: 4 }]);
    expect(JSON.parse(String(calls[1].init.body))).toEqual(['zrevrange', 'rank:2026-W41', 0, 1, 'withscores']);
    expect(JSON.parse(String(calls[2].init.body))[0]).toBe('set');
  });

  it('top은 스냅샷이 있으면 그대로 쓴다', async () => {
    const calls: Call[] = [];
    const snap = { at: '2026-10-07T00:00:00.000Z', entries: [{ userId: 'u1', score: 9 }] };
    const store = makeStore([JSON.stringify(snap)], calls);
    expect(await store.top('2026-W41', 50)).toEqual(snap);
    expect(calls).toHaveLength(1);
  });

  it('rankOf는 1-based 순위를 준다', async () => {
    const calls: Call[] = [];
    const store = makeStore([4, '12'], calls);
    expect(await store.rankOf('2026-W41', 'u1')).toEqual({ rank: 5, score: 12 });
  });

  it('rankOf는 순위가 없으면 null이다', async () => {
    const calls: Call[] = [];
    const store = makeStore([null, null], calls);
    expect(await store.rankOf('2026-W41', 'u1')).toEqual({ rank: null, score: 0 });
  });

  it('오류 응답은 던진다', async () => {
    const fetchImpl = (async () => new Response(null, { status: 500 })) as typeof fetch;
    const store = createRankStore({ url: 'https://example.upstash.io', token: 'tok', fetchImpl });
    await expect(store.increment('2026-W41', 'u1', 1)).rejects.toThrow();
  });
});

describe('rebuildFromLedger', () => {
  it('원장 합계를 ZADD로 재구성한다', async () => {
    const db = createMemoryDb();
    await db.insertStage({ id: 'e-1', size: 7, regions: '0'.repeat(49), solution: '0,0', tier: 2, seed: 1 });
    await db.commitEndlessClear('u1', 'e-1', { earned: 3, season: '2026-W41', seedLeft: 3, elapsedMs: 30000, suspicious: false, atIso: '2026-10-07T00:00:00.000Z' });
    const calls: Call[] = [];
    const store = makeStore(['OK'], calls);
    expect(await rebuildFromLedger(db, store, '2026-W41')).toBe(1);
    expect(JSON.parse(String(calls[0].init.body))).toEqual(['zadd', 'rank:2026-W41', 3, 'u1']);
  });
});

describe('rankStoreFromEnv', () => {
  it('env가 없으면 null이다', () => {
    expect(rankStoreFromEnv({})).toBeNull();
  });
  it('env가 있으면 저장소를 만든다', () => {
    expect(rankStoreFromEnv({ UPSTASH_REDIS_REST_URL: 'https://u', UPSTASH_REDIS_REST_TOKEN: 't' })).not.toBeNull();
  });
});
