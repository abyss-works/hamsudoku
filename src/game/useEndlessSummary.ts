import { useCallback, useEffect, useState } from 'react';
import { fetchMe, fetchRank } from '../api/endlessApi';
import type { MeResponse, RankResponse } from '../shared/endless';

export interface EndlessSummaryState {
  me: MeResponse | null;
  rank: RankResponse | null;
  loading: boolean;
  error: string | null;
  refresh(): Promise<void>;
  /** 이미 불러온 값은 유지하면서 조용히 다시 요청한다. 화면전환 갱신용. */
  refreshSoft(): Promise<void>;
}

export function useEndlessSummary(enabled: boolean): EndlessSummaryState {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [rank, setRank] = useState<RankResponse | null>(null);
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
    if (!enabled) return;
    try {
      const [m, r] = await Promise.all([fetchMe(), fetchRank()]);
      setMe(m);
      setRank(r);
    } catch {
      // 이미 표시 중인 값이 있으면 유지한다. 에러 문구도 갈아쓰지 않는다.
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { me, rank, loading, error, refresh, refreshSoft };
}
