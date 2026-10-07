import { useCallback, useEffect, useState } from 'react';
import { fetchMe, fetchRank } from '../api/endlessApi';
import type { MeResponse, RankResponse } from '../shared/endless';

export interface EndlessSummaryState {
  me: MeResponse | null;
  rank: RankResponse | null;
  loading: boolean;
  error: string | null;
  refresh(): Promise<void>;
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

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { me, rank, loading, error, refresh };
}
