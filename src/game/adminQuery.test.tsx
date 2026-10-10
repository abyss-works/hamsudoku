// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryProvider } from './queryClient';
import { useAdminRank } from './useAdminRank';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('관리자 조회도 동일 계정 요청을 공유한다', async () => {
  const fetch = vi.fn(async () => Response.json({ season: 'S', entries: [] }));
  vi.stubGlobal('fetch', fetch);
  const { result } = renderHook(() => [useAdminRank('admin'), useAdminRank('admin')], { wrapper: QueryProvider });
  await waitFor(() => expect(result.current[0].loading).toBe(false));
  expect(fetch).toHaveBeenCalledTimes(1);
});
