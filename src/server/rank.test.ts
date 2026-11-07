import { describe, expect, it, vi } from 'vitest';
import { createRankCache, RANK_CACHE_TTL_MS } from './rank';

function clock(start = 1_800_000_000_000) {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

const ENTRIES = [
  { userId: 'a', score: 5 },
  { userId: 'b', score: 3 },
];

describe('createRankCache', () => {
  it('TTL 안의 같은 시즌 요청은 적재 함수를 다시 호출하지 않고 같은 스냅샷을 돌려준다', async () => {
    const time = clock();
    const cache = createRankCache({ now: time.now });
    const load = vi.fn(async () => ENTRIES);

    const first = await cache.top('2026-W41', 50, load);
    time.advance(RANK_CACHE_TTL_MS - 1);
    const second = await cache.top('2026-W41', 50, load);

    expect(load).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(first).toEqual({ at: new Date(1_800_000_000_000).toISOString(), season: '2026-W41', entries: ENTRIES });
  });

  it('TTL이 지나면 다시 적재하고 갱신 시각을 새로 기록한다', async () => {
    const time = clock();
    const cache = createRankCache({ now: time.now });
    const load = vi.fn<() => Promise<typeof ENTRIES>>().mockResolvedValueOnce(ENTRIES).mockResolvedValueOnce([ENTRIES[1]]);

    await cache.top('2026-W41', 50, load);
    time.advance(RANK_CACHE_TTL_MS);
    const refreshed = await cache.top('2026-W41', 50, load);

    expect(load).toHaveBeenCalledTimes(2);
    expect(refreshed.entries).toEqual([ENTRIES[1]]);
    expect(refreshed.at).toBe(new Date(1_800_000_000_000 + RANK_CACHE_TTL_MS).toISOString());
  });

  it('시즌과 개수 제한별로 따로 캐시한다', async () => {
    const cache = createRankCache({ now: clock().now });
    const load = vi.fn(async () => ENTRIES);

    await cache.top('2026-W41', 50, load);
    await cache.top('2026-W42', 50, load);
    await cache.top('2026-W41', 10, load);

    expect(load).toHaveBeenCalledTimes(3);
  });

  it('갱신 중인 같은 요청은 적재를 하나만 실행하고 결과를 공유한다', async () => {
    const cache = createRankCache({ now: clock().now });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const load = vi.fn(async () => {
      await gate;
      return ENTRIES;
    });

    const pending = [cache.top('2026-W41', 50, load), cache.top('2026-W41', 50, load)];
    release();
    const [a, b] = await Promise.all(pending);

    expect(load).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it('적재가 실패하면 오류를 전달하고 실패를 캐시하지 않는다', async () => {
    const cache = createRankCache({ now: clock().now });
    const load = vi.fn<() => Promise<typeof ENTRIES>>().mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce(ENTRIES);

    await expect(cache.top('2026-W41', 50, load)).rejects.toThrow('db down');
    const recovered = await cache.top('2026-W41', 50, load);

    expect(recovered.entries).toEqual(ENTRIES);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('상위 limit개만 보관한다', async () => {
    const cache = createRankCache({ now: clock().now });
    const snapshot = await cache.top('2026-W41', 1, async () => ENTRIES);
    expect(snapshot.entries).toEqual([ENTRIES[0]]);
  });

  it('invalidate는 해당 시즌의 캐시만 비워 다음 요청이 다시 적재하게 한다', async () => {
    const cache = createRankCache({ now: clock().now });
    const load = vi.fn(async () => ENTRIES);
    await cache.top('2026-W41', 50, load);
    await cache.top('2026-W42', 50, load);

    cache.invalidate('2026-W41');
    await cache.top('2026-W41', 50, load);
    await cache.top('2026-W42', 50, load);

    expect(load).toHaveBeenCalledTimes(3);
  });

  it('갱신 도중 invalidate된 적재 결과는 캐시에 남기지 않는다', async () => {
    const cache = createRankCache({ now: clock().now });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const slow = vi.fn(async () => {
      await gate;
      return ENTRIES;
    });
    const pending = cache.top('2026-W41', 50, slow);
    cache.invalidate('2026-W41');
    release();
    await pending;

    const fresh = vi.fn(async () => [ENTRIES[1]]);
    expect((await cache.top('2026-W41', 50, fresh)).entries).toEqual([ENTRIES[1]]);
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it('clear는 모든 시즌의 캐시를 비운다', async () => {
    const cache = createRankCache({ now: clock().now });
    const load = vi.fn(async () => ENTRIES);
    await cache.top('2026-W41', 50, load);
    cache.clear();
    await cache.top('2026-W41', 50, load);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
