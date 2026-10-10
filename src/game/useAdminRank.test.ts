// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryProvider } from './queryClient';
import { useAdminRank } from './useAdminRank';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useAdminRank', () => {
  it('게스트 엔트리(nickname null)만 guestEntries로 필터링한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          ok: true,
          season: '2026-W41',
          entries: [
            { userId: 'g1', nickname: null, score: 9 },
            { userId: 'm1', nickname: '햄찌', score: 5 },
          ],
        }),
      ),
    );
    const { result } = renderHook(() => useAdminRank(null), { wrapper: QueryProvider });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.guestEntries).toEqual([{ userId: 'g1', nickname: null, score: 9 }]);
  });

  it('403이면 권한 오류를 표시한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 403 })));
    const { result } = renderHook(() => useAdminRank(null), { wrapper: QueryProvider });
    await waitFor(() => {
      expect(result.current.error).toBe('권한이 없어요.');
    });
  });

  it('삭제는 선택 데이터를 POST로 보내고 목록을 갱신한다', async () => {
    const posts: Array<{ url: string; body: string | null | undefined }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          posts.push({ url, body: typeof init.body === 'string' ? init.body : null });
          return Response.json({ ok: true, removed: 2 });
        }
        return Response.json({ ok: true, season: 'S', entries: [] });
      }),
    );
    const { result } = renderHook(() => useAdminRank(null), { wrapper: QueryProvider });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    result.current.toggle('g1');
    result.current.toggle('g2');
    await waitFor(() => {
      expect(result.current.selected.length).toBe(2);
    });
    const removed = await result.current.removeSelected();
    expect(removed).toBe(2);
    expect(posts.length).toBe(1);
    expect(JSON.parse(posts[0].body ?? '{}').userIds).toEqual(['g1', 'g2']);
  });
});


