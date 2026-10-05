// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pull, pushClear, reconcile } from './sync';
import type { ClearEntry } from './save';

afterEach(() => {
  vi.unstubAllGlobals();
});

const entry = (code: string, elapsed: number, at: string, attempts = 1): ClearEntry => ({
  stageCode: code,
  clearedAt: at,
  elapsedSec: elapsed,
  attempts,
});

const okRecords = (clears: unknown[]) => vi.fn(async () => Response.json({ clears }));

describe('pull', () => {
  it('서버분을 로컬과 합쳐 덮어쓴다', async () => {
    vi.stubGlobal(
      'fetch',
      okRecords([{ stageCode: '1-1', bestElapsedSec: 50, attempts: 2, lastClearedAt: 't9' }]),
    );
    const { clears, unauthorized } = await pull([entry('1-1', 90, 't1')]);
    expect(unauthorized).toBe(false);
    expect(clears.find((c) => c.stageCode === '1-1')).toMatchObject({ elapsedSec: 50, attempts: 2 });
  });
  it('서버가 죽으면 로컬을 그대로 둔다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('down');
      }),
    );
    const local = [entry('1-1', 90, 't1')];
    const { clears, unauthorized } = await pull(local);
    expect(unauthorized).toBe(false);
    expect(clears).toEqual(local);
  });
  it('401이면 미인증으로 알린다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })));
    const { unauthorized } = await pull([entry('1-1', 90, 't1')]);
    expect(unauthorized).toBe(true);
  });
});

describe('pushClear', () => {
  it('성공·오프라인·미인증을 구분한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ok: true })));
    expect(await pushClear('1-1', 60, 'key-1')).toBe('ok');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })));
    expect(await pushClear('1-1', 60, 'key-1')).toBe('unauthorized');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('down');
      }),
    );
    expect(await pushClear('1-1', 60, 'key-1')).toBe('offline');
  });
});

describe('reconcile', () => {
  it('서버에 없는 로컬 기록을 미검증으로 밀어올린다', async () => {
    const posts: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, _init?: RequestInit) => {
        if (typeof url === 'string' && url.endsWith('/api/records')) return Response.json({ clears: [] });
        posts.push(String(url));
        return Response.json({ ok: true });
      }),
    );
    const { clears } = await reconcile([entry('1-1', 60, 't1')]);
    expect(posts).toEqual(['/api/clear']);
    expect(clears).toHaveLength(1);
  });
});
