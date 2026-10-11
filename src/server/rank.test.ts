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

  it('increment는 시즌 키에 만료 TTL을 건다', async () => {
    const calls: Call[] = [];
    const store = makeStore([7, 1], calls);
    await store.increment('2026-W41', 'u1', 3);
    expect(JSON.parse(String(calls[1].init.body))).toEqual(['expire', 'rank:2026-W41', 1209600]);
  });

  it('top은 스냅샷이 없으면 만들고 저장한다', async () => {
    const calls: Call[] = [];
    const store = makeStore([null, ['u1', 9, 'u2', 4], 'OK'], calls);
    const snap = await store.top('2026-W41', 2);
    expect(snap.entries).toEqual([{ userId: 'u1', score: 9 }, { userId: 'u2', score: 4 }]);
    expect(JSON.parse(String(calls[1].init.body))).toEqual(['zrevrange', 'rank:2026-W41', 0, 1, 'withscores']);
    expect(JSON.parse(String(calls[2].init.body))[0]).toBe('set');
  });

  it('top은 유효한 스냅샷이 있으면 그대로 쓴다', async () => {
    const calls: Call[] = [];
    const snap = { at: new Date().toISOString(), season: '2026-W41', entries: [{ userId: 'u1', score: 9 }] };
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

  it('top은 JSON 구문 오류 시 캐시 미스로 처리하고 ZSET에서 다시 읽는다', async () => {
    const calls: Call[] = [];
    const store = makeStore(['{invalid-json', ['u1', 10], 'OK'], calls);
    const snap = await store.top('2026-W41', 50);
    expect(snap.entries).toEqual([{ userId: 'u1', score: 10 }]);
    expect(calls).toHaveLength(3);
    expect(JSON.parse(String(calls[1].init.body))[0]).toBe('zrevrange');
  });

  it('top은 60초가 지난 캐시 스냅샷(TTL 누락 등)을 만료로 보고 갱신한다', async () => {
    const calls: Call[] = [];
    const staleSnap = {
      at: new Date(Date.now() - 70_000).toISOString(),
      season: '2026-W41',
      entries: [{ userId: 'u-old', score: 99 }],
    };
    const store = makeStore([JSON.stringify(staleSnap), ['u-fresh', 20], 'OK'], calls);
    const snap = await store.top('2026-W41', 50);
    expect(snap.entries).toEqual([{ userId: 'u-fresh', score: 20 }]);
    expect(calls).toHaveLength(3);
    expect(JSON.parse(String(calls[1].init.body))[0]).toBe('zrevrange');
  });

  it('top은 시즌이 일치하지 않는 캐시를 무시하고 ZSET에서 새로 읽는다', async () => {
    const calls: Call[] = [];
    const wrongSeasonSnap = {
      at: new Date().toISOString(),
      season: '2026-W40',
      entries: [{ userId: 'u-w40', score: 50 }],
    };
    const store = makeStore([JSON.stringify(wrongSeasonSnap), ['u-w41', 30], 'OK'], calls);
    const snap = await store.top('2026-W41', 50);
    expect(snap.entries).toEqual([{ userId: 'u-w41', score: 30 }]);
    expect(calls).toHaveLength(3);
  });

  it('top은 ZSET에 동일 userId 중복이 있으면 최고 점수 1건으로 합친다', async () => {
    const calls: Call[] = [];
    const store = makeStore([null, ['u1', 20, 'u1', 10, 'u2', 5], 'OK'], calls);
    const snap = await store.top('2026-W41', 50);
    expect(snap.entries).toEqual([
      { userId: 'u1', score: 20 },
      { userId: 'u2', score: 5 },
    ]);
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
    const store = makeStore(['OK', 'OK'], calls);
    expect(await rebuildFromLedger(db, store, '2026-W41')).toBe(1);
    expect(JSON.parse(String(calls[0].init.body))).toEqual(['zadd', 'rank:2026-W41', 3, 'u1']);
    expect(JSON.parse(String(calls[1].init.body))).toEqual(['expire', 'rank:2026-W41', 1209600]);
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

describe('createRankStore 관리자 기능', () => {
  it('topAll은 전체 목록을 내림차순으로 돌려준다', async () => {
    const calls: Call[] = [];
    const store = makeStore([['u1', 12, 'u2', 3]], calls);
    const snap = await store.topAll('2026-W41', 100);
    expect(snap.entries).toEqual([
      { userId: 'u1', score: 12 },
      { userId: 'u2', score: 3 },
    ]);
    expect(calls[0].init.body).toContain('zrevrange');
  });

  it('remove는 zrem 명령을 보내고 삭제 수를 돌려준다', async () => {
    const calls: Call[] = [];
    const store = makeStore([1], calls);
    expect(await store.remove('2026-W41', 'guest1')).toBe(1);
    expect(String(calls[0].init.body)).toContain('zrem');
  });
});
