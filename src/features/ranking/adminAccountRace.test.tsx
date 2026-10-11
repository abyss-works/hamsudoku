// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryProvider } from '../../core/queryClient';
import { useAdminRank } from './useAdminRank';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('이전 계정 삭제 완료가 새 계정 선택을 지우지 않는다', async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') { await pending; return Response.json({ removed: 1 }); }
    return Response.json({ season: 'S', entries: [] });
  }));
  const { result, rerender } = renderHook(({ uid }) => useAdminRank(uid), { initialProps: { uid: 'a' }, wrapper: QueryProvider });
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => result.current.toggle('old'));
  let removing!: Promise<number>;
  act(() => { removing = result.current.removeSelected(); });
  rerender({ uid: 'b' });
  act(() => result.current.toggle('new'));
  await act(async () => { finish(); await removing; });
  expect(result.current.selected).toEqual(['new']);
});
it('계정 전환 전 관리자 액션은 요청하지 않는다', async () => {
  const fetch = vi.fn(async () => Response.json({ season: 'S', entries: [], removed: 1 }));
  vi.stubGlobal('fetch', fetch);
  const { result, rerender } = renderHook(({ uid }) => useAdminRank(uid), { initialProps: { uid: 'a' }, wrapper: QueryProvider });
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => result.current.toggle('old'));
  const old = result.current;
  rerender({ uid: 'b' });
  await waitFor(() => expect(result.current.loading).toBe(false));
  const count = fetch.mock.calls.length;
  await act(async () => { await old.refresh(); await old.removeSelected(); });
  expect(fetch).toHaveBeenCalledTimes(count);
});
it('이전 계정 toggle은 새 계정 선택을 변경하지 않는다', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ season: 'S', entries: [] })));
  const { result, rerender } = renderHook(({ uid }) => useAdminRank(uid), { initialProps: { uid: 'a' }, wrapper: QueryProvider });
  await waitFor(() => expect(result.current.loading).toBe(false));
  const old = result.current;
  rerender({ uid: 'b' });
  act(() => result.current.toggle('new'));
  act(() => old.toggle('old'));
  expect(result.current.selected).toEqual(['new']);
});
