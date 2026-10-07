// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEndlessSummary } from './useEndlessSummary';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useEndlessSummary', () => {
  it('요약과 랭킹을 불러온다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/endless/me')
          return Response.json({ wallet: { balance: 5 }, clearedCount: 2, streak: { current: 1, best: 3 }, season: '2026-W41' });
        if (url === '/api/endless/rank')
          return Response.json({ season: '2026-W41', top: [], snapshotAt: '2026-10-07T00:00:00.000Z', me: { rank: 3, score: 12 } });
        throw new Error(`unexpected ${url}`);
      }),
    );
    const { result } = renderHook(() => useEndlessSummary(true));
    await waitFor(() => {
      expect(result.current.me?.wallet.balance).toBe(5);
    });
    expect(result.current.rank?.me.rank).toBe(3);
  });

  it('비활성이면 요청하지 않는다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useEndlessSummary(false));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('실패하면 오류 문구를 남긴다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })));
    const { result } = renderHook(() => useEndlessSummary(true));
    await waitFor(() => {
      expect(result.current.error).toBe('요약을 불러오지 못했어요.');
    });
  });
});
