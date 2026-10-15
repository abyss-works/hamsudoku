// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pull, pushClear, reconcile } from './sync';
import type { ClearEntry } from '../../../platform/storage/save';

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
    const { clears, unauthorized, failed } = await pull([entry('1-1', 90, 't1')]);
    expect(unauthorized).toBe(false);
    expect(failed).toBe(false);
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
    const { clears, unauthorized, failed } = await pull(local);
    expect(unauthorized).toBe(false);
    expect(failed).toBe(true);
    expect(clears).toEqual(local);
  });
  it('5xx도 조회 실패로 표시한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })));
    const { failed, unauthorized } = await pull([]);
    expect(failed).toBe(true);
    expect(unauthorized).toBe(false);
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
  it('계정 컨텍스트가 바뀌면 남은 기록을 올리지 않는다', async () => {
    const posts: string[] = [];
    let release!: () => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (typeof url === 'string' && url.endsWith('/api/records')) return Response.json({ clears: [] });
        posts.push(String(url));
        // 첫 전송을 보류해 두고, 그 사이에 계정 컨텍스트가 바뀐 상황을 만든다.
        return new Promise<Response>((resolve) => {
          release = () => resolve(Response.json({ ok: true }));
        });
      }),
    );
    let alive = true;
    const local = [entry('1-1', 60, 't1'), entry('1-2', 70, 't2'), entry('1-3', 80, 't3')];
    const pending = reconcile(local, () => alive);
    await vi.waitFor(() => expect(posts).toHaveLength(1));
    alive = false;
    release();
    const { clears, failed } = await pending;
    expect(posts).toHaveLength(1);
    expect(failed).toBe(true);
    expect(clears).toEqual(local);
  });
});
