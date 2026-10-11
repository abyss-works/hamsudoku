// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryProvider } from '../../core/queryClient';
import { useEndlessSummary } from './useEndlessSummary';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('같은 계정의 동시 조회는 요청을 공유한다', async () => {
  const fetch = vi.fn(async (url: string) => Response.json(url.endsWith('/me') ? { wallet: { balance: 7 }, clearedCount: 0, streak: { current: 0, best: 0 }, season: '2026-W41' } : { season: '2026-W41', top: [], snapshotAt: '2026-10-07T00:00:00.000Z', me: { rank: null, score: 0 }, frozen: false }));
  vi.stubGlobal('fetch', fetch);
  const { result } = renderHook(() => [useEndlessSummary(true, 'a'), useEndlessSummary(true, 'a')], { wrapper: QueryProvider });
  await waitFor(() => expect(result.current[0].me?.wallet.balance).toBe(7));
  expect(fetch).toHaveBeenCalledTimes(2);
});
it('계정 전환은 이전 값과 오래된 응답을 표시하지 않는다', async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let call = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const original = ++call <= 2;
    if (original) await pending;
    return Response.json(url.endsWith('/me') ? { wallet: { balance: original ? 1 : 9 }, clearedCount: 0, streak: { current: 0, best: 0 }, season: '2026-W41' } : { season: '2026-W41', top: [], snapshotAt: '2026-10-07T00:00:00.000Z', me: { rank: null, score: 0 }, frozen: false });
  }));
  const { result, rerender } = renderHook(({ uid }) => useEndlessSummary(true, uid), { initialProps: { uid: 'a' }, wrapper: QueryProvider });
  rerender({ uid: 'b' });
  expect(result.current.me).toBeNull();
  await waitFor(() => expect(result.current.me?.wallet.balance).toBe(9));
  await act(async () => release());
  expect(result.current.me?.wallet.balance).toBe(9);
});

it('전환 전 저장한 갱신 액션은 새 계정으로 요청하지 않는다', async () => {
  const fetch = vi.fn(async (url: string) => Response.json(url.endsWith('/me')
    ? { wallet: { balance: 7 }, clearedCount: 0, streak: { current: 0, best: 0 }, season: '2026-W41' }
    : { season: '2026-W41', top: [], snapshotAt: '2026-10-07T00:00:00.000Z', me: { rank: null, score: 0 }, frozen: false }));
  vi.stubGlobal('fetch', fetch);
  const { result, rerender } = renderHook(({ uid }) => useEndlessSummary(true, uid), { initialProps: { uid: 'a' }, wrapper: QueryProvider });
  await waitFor(() => expect(result.current.me?.wallet.balance).toBe(7));
  const old = result.current;
  rerender({ uid: 'b' });
  await waitFor(() => expect(result.current.me?.wallet.balance).toBe(7));
  const count = fetch.mock.calls.length;
  await act(async () => { await old.refresh(); await old.refreshSoft(); await old.refreshMyRank(); });
  expect(fetch).toHaveBeenCalledTimes(count);
});
