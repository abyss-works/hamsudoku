import { useCallback, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMe, fetchMyRank, fetchRank } from './endlessApi';
import type { MeResponse, MyRankResponse, RankResponse } from '../../shared/endless';

export interface EndlessSummaryState {
  me: MeResponse | null;
  rank: RankResponse | null;
  myRank: MyRankResponse | null;
  loading: boolean;
  error: string | null;
  refresh(): Promise<void>;
  refreshSoft(): Promise<MeResponse | null>;
  refreshMyRank(): Promise<void>;
}

export function useEndlessSummary(enabled: boolean, uid: string | null = null): EndlessSummaryState {
  const active = useRef({ uid, enabled });
  active.current = { uid, enabled };
  const [status, setStatus] = useState<{ uid: string | null; loading: boolean; error: string | null } | null>(null);
  const summary = useQuery({
    queryKey: ['endless-summary', uid],
    enabled,
    queryFn: async () => {
      const [me, rank] = await Promise.all([fetchMe(), fetchRank()]);
      return { me, rank };
    },
  });
  const myRank = useQuery({ queryKey: ['endless-my-rank', uid], queryFn: fetchMyRank, enabled: false });
  const refresh = useCallback(async () => {
    if (!enabled || active.current.uid !== uid || !active.current.enabled) return;
    setStatus({ uid, loading: true, error: null });
    const result = await summary.refetch({ cancelRefetch: false });
    if (active.current.uid !== uid || !active.current.enabled) return;
    setStatus({ uid, loading: false, error: result.error ? '요약을 불러오지 못했어요.' : null });
  }, [enabled, uid, summary.refetch]);
  const refreshSoft = useCallback(async () => {
    if (!enabled || active.current.uid !== uid || !active.current.enabled) return null;
    if (summary.error && !summary.data) {
      setStatus((prev) => prev?.uid === uid ? prev : { uid, loading: false, error: '요약을 불러오지 못했어요.' });
    }
    const result = await summary.refetch({ cancelRefetch: false });
    if (active.current.uid !== uid || !active.current.enabled || result.error) return null;
    return result.data?.me ?? null;
  }, [enabled, uid, summary.refetch, summary.error, summary.data]);
  const refreshMyRank = useCallback(async () => {
    if (enabled && active.current.uid === uid && active.current.enabled) {
      await myRank.refetch({ cancelRefetch: false });
    }
  }, [enabled, uid, myRank.refetch]);
  const currentStatus = status?.uid === uid ? status : null;
  return {
    me: summary.data?.me ?? null,
    rank: summary.data?.rank ?? null,
    myRank: myRank.data ?? null,
    loading: enabled && (currentStatus?.loading === true || (summary.isPending && summary.isFetching)),
    error: currentStatus ? currentStatus.error : summary.error && !summary.data ? '요약을 불러오지 못했어요.' : null,
    refresh,
    refreshSoft,
    refreshMyRank,
  };
}
