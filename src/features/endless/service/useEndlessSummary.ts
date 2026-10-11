import { useCallback, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMe, fetchMyRank, fetchRank } from '../api/endlessApi';
import type { MeResponse, MyRankResponse, RankResponse } from '../../../shared/endless';

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
  const [myRankPending, setMyRankPending] = useState(false);

  // 개인 요약(지갑/스트릭)과 랭킹 쿼리를 분리하여 랭킹 오류가 개인 요약 로드를 차단하지 않는다.
  const meQuery = useQuery({
    queryKey: ['endless-me', uid],
    enabled,
    queryFn: fetchMe,
  });

  const rankQuery = useQuery({
    queryKey: ['endless-rank', uid],
    enabled,
    queryFn: async () => {
      try {
        return await fetchRank();
      } catch {
        return null;
      }
    },
  });

  const myRank = useQuery({ queryKey: ['endless-my-rank', uid], queryFn: fetchMyRank, enabled: false });

  const refresh = useCallback(async () => {
    if (!enabled || active.current.uid !== uid || !active.current.enabled) return;
    setStatus({ uid, loading: true, error: null });
    const [meResult] = await Promise.all([
      meQuery.refetch({ cancelRefetch: false }),
      rankQuery.refetch({ cancelRefetch: false }),
    ]);
    if (active.current.uid !== uid || !active.current.enabled) return;
    setStatus({ uid, loading: false, error: meResult.error ? '요약을 불러오지 못했어요.' : null });
  }, [enabled, uid, meQuery.refetch, rankQuery.refetch]);

  const refreshSoft = useCallback(async () => {
    if (!enabled || active.current.uid !== uid || !active.current.enabled) return null;
    if (meQuery.error && !meQuery.data) {
      setStatus((prev) => (prev?.uid === uid ? prev : { uid, loading: false, error: '요약을 불러오지 못했어요.' }));
    }
    const [result] = await Promise.all([
      meQuery.refetch({ cancelRefetch: false }),
      rankQuery.refetch({ cancelRefetch: false }),
    ]);
    if (active.current.uid !== uid || !active.current.enabled || result.error) return null;
    return result.data ?? null;
  }, [enabled, uid, meQuery.refetch, rankQuery.refetch, meQuery.error, meQuery.data]);

  const refreshMyRank = useCallback(async () => {
    if (enabled && active.current.uid === uid && active.current.enabled) {
      setMyRankPending(true);
      try {
        await myRank.refetch({ cancelRefetch: false });
      } finally {
        setMyRankPending(false);
      }
    }
  }, [enabled, uid, myRank.refetch]);

  const currentStatus = status?.uid === uid ? status : null;

  return {
    me: meQuery.data ?? null,
    rank: rankQuery.data ?? null,
    // 열 때마다 hot fetch pending/error 시 이전 stale 데이터를 현재 응답처럼 보여주지 않는다.
    myRank: myRankPending || myRank.isError ? null : (myRank.data ?? null),
    loading: enabled && (currentStatus?.loading === true || (meQuery.isPending && meQuery.isFetching)),
    error: currentStatus ? currentStatus.error : meQuery.error && !meQuery.data ? '요약을 불러오지 못했어요.' : null,
    refresh,
    refreshSoft,
    refreshMyRank,
  };
}
