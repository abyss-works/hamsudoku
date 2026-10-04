import { useEffect, useState } from 'react';
import { fetchStages, type Chapter } from '../api/stagesApi';

export interface StagesState {
  chapters: Chapter[];
  loading: boolean;
  error: string | null;
}

export function useStages(): StagesState {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStages()
      .then((list) => {
        setChapters(list);
        setLoading(false);
      })
      .catch(() => {
        setError('스테이지 목록을 불러오지 못했다');
        setLoading(false);
      });
  }, []);

  return { chapters, loading, error };
}
