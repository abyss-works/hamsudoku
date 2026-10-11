// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryProvider } from '../../../core/queryClient';
import { useEndlessSummary } from '../service/useEndlessSummary';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('조용한 갱신 실패는 기존 값과 오류를 유지하고 자동 재요청하지 않는다', async () => {
  let fail = false;
  const fetch = vi.fn(async (url: string) => fail ? new Response(null, { status: 500 }) : Response.json(url.endsWith('/me')
    ? { wallet: { balance: 7 }, clearedCount: 0, streak: { current: 0, best: 0 }, season: '2026-W41' }
    : { season: '2026-W41', top: [], snapshotAt: '2026-10-07T00:00:00.000Z', me: { rank: null, score: 0 }, frozen: false }));
  vi.stubGlobal('fetch', fetch);
  const { result } = renderHook(() => useEndlessSummary(true, 'a'), { wrapper: QueryProvider });
  await waitFor(() => expect(result.current.me?.wallet.balance).toBe(7));
  fail = true;
  await act(async () => expect(await result.current.refreshSoft()).toBeNull());
  expect(result.current.me?.wallet.balance).toBe(7);
  expect(result.current.error).toBeNull();
  window.dispatchEvent(new Event('focus'));
  window.dispatchEvent(new Event('online'));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
  expect(fetch).toHaveBeenCalledTimes(4);
  await act(async () => { await result.current.refresh(); });
  expect(result.current.error).toBe('요약을 불러오지 못했어요.');
  expect(result.current.me?.wallet.balance).toBe(7);
});
it('초기 실패의 오류는 조용한 갱신 성공 뒤에도 명시적 갱신 전까지 유지한다', async () => {
  let fail = true;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => fail ? new Response(null, { status: 500 }) : Response.json(url.endsWith('/me')
    ? { wallet: { balance: 7 }, clearedCount: 0, streak: { current: 0, best: 0 }, season: '2026-W41' }
    : { season: '2026-W41', top: [], snapshotAt: '2026-10-07T00:00:00.000Z', me: { rank: null, score: 0 }, frozen: false })));
  const { result } = renderHook(() => useEndlessSummary(true, 'a'), { wrapper: QueryProvider });
  await waitFor(() => expect(result.current.error).toBe('요약을 불러오지 못했어요.'));
  fail = false;
  await act(async () => { await result.current.refreshSoft(); });
  await waitFor(() => expect(result.current.me?.wallet.balance).toBe(7));
  expect(result.current.error).toBe('요약을 불러오지 못했어요.');
  await act(async () => { await result.current.refresh(); });
  expect(result.current.error).toBeNull();
});
