import { useCallback, useEffect, useState } from 'react';
import { fetchMe, fetchMyRank, fetchRank } from '../api/endlessApi';
import type { MeResponse, MyRankResponse, RankResponse } from '../shared/endless';

export interface EndlessSummaryState {
  me: MeResponse | null;
  rank: RankResponse | null;
  /** 내 순위 실시간 값. 랭킹을 열 때 따로 가져온다. */
  myRank: MyRankResponse | null;
  loading: boolean;
  error: string | null;
  refresh(): Promise<void>;
  /** 이미 불러온 값은 유지하면서 조용히 다시 요청한다. 화면전환 갱신용. 가져온 요약을 그대로 돌려준다. */
  refreshSoft(): Promise<MeResponse | null>;
  /** 내 순위만 조용히 다시 요청한다. 랭킹 열기용. */
  refreshMyRank(): Promise<void>;
}

export function useEndlessSummary(enabled: boolean): EndlessSummaryState {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [rank, setRank] = useState<RankResponse | null>(null);
  const [myRank, setMyRank] = useState<MyRankResponse | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [m, r] = await Promise.all([fetchMe(), fetchRank()]);
      setMe(m);
      setRank(r);
    } catch {
      setError('요약을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  // 화면전환 갱신용 조용한 재요청. loading 표시와 error 리셋을 하지 않아
  // 부팅 게이트(dataReady의 me/error 유무 판정)를 재고정하지 않는다.
  const refreshSoft = useCallback(async () => {
    if (!enabled) return null;
    try {
      const [m, r] = await Promise.all([fetchMe(), fetchRank()]);
      setMe(m);
      setRank(r);
      return m;
    } catch {
      // 이미 표시 중인 값이 있으면 유지한다. 에러 문구도 갈아쓰지 않는다.
      return null;
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const refreshMyRank = useCallback(async () => {
    if (!enabled) return;
    try {
      setMyRank(await fetchMyRank());
    } catch {
      // 이미 표시 중인 값이 있으면 유지한다.
    }
  }, [enabled]);

  return { me, rank, myRank, loading, error, refresh, refreshSoft, refreshMyRank };
}
