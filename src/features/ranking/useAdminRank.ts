'use client';

import { useCallback, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAdminRank, removeRankEntries } from './adminApi';
export type { AdminRankEntry } from './adminApi';

export function useAdminRank(uid?: string | null) {
  const query = useQuery({
    queryKey: ['admin-rank', uid],
    queryFn: fetchAdminRank,
    enabled: uid !== undefined,
  });
  const [selection, setSelection] = useState<{ uid: string | null | undefined; ids: string[] }>({ uid, ids: [] });
  const activeUid = useRef(uid);
  activeUid.current = uid;
  const selected = selection.uid === uid ? selection.ids : [];
  const refresh = useCallback(async () => {
    if (uid !== undefined && activeUid.current === uid) {
      await query.refetch({ cancelRefetch: false });
    }
  }, [uid, query.refetch]);
  const toggle = (id: string) => setSelection((prev) => {
    if (activeUid.current !== uid) return prev;
    const ids = prev.uid === uid ? prev.ids : [];
    return { uid, ids: ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id] };
  });
  const removeSelected = useCallback(async () => {
    if (!selected.length || uid === undefined || activeUid.current !== uid) return 0;
    const removed = await removeRankEntries(selected);
    if (activeUid.current === uid) {
      setSelection({ uid, ids: [] });
      await refresh();
    }
    return removed;
  }, [selected, uid, refresh]);
  const entries = query.error ? [] : query.data?.entries ?? [];
  return {
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
    season: query.error ? null : query.data?.season ?? null,
    entries,
    guestEntries: entries.filter((entry) => entry.nickname === null),
    selected,
    toggle,
    removeSelected,
    refresh,
  };
}
