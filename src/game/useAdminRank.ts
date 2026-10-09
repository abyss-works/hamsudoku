'use client';

import { useCallback, useEffect, useState } from 'react';

export interface AdminRankEntry {
  userId: string;
  nickname: string | null;
  score: number;
}

interface AdminRankState {
  loading: boolean;
  error: string | null;
  season: string | null;
  entries: AdminRankEntry[];
}

/** 관리자 랭킹 패널 상태. View는 이 훅만 본다. */
export function useAdminRank(): AdminRankState & {
  guestEntries: AdminRankEntry[];
  selected: string[];
  toggle: (uid: string) => void;
  removeSelected: () => Promise<number>;
} {
  const [state, setState] = useState<AdminRankState>({ loading: true, error: null, season: null, entries: [] });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/rank');
      if (res.status === 403) throw new Error('권한이 없어요.');
      if (res.status === 503) throw new Error('랭킹 스토어 미설정.');
      if (!res.ok) throw new Error('불러오기 실패');
      const data = (await res.json()) as { season: string; entries: AdminRankEntry[] };
      setState({ loading: false, error: null, season: data.season, entries: data.entries });
    } catch (e) {
      setState({ loading: false, error: e instanceof Error ? e.message : '오류', season: null, entries: [] });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const guestEntries = state.entries.filter((e) => e.nickname === null);
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (uid: string) =>
    setSelected((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));

  const removeSelected = useCallback(async () => {
    if (selected.length === 0) return 0;
    const res = await fetch('/api/admin/rank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: selected }),
    });
    if (!res.ok) throw new Error('삭제 실패');
    const data = (await res.json()) as { removed: number };
    setSelected([]);
    await refresh();
    return data.removed;
  }, [selected, refresh]);

  return { ...state, guestEntries, selected, toggle, removeSelected };
}
