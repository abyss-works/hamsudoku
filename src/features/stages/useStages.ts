import { useQuery } from '@tanstack/react-query';
import { stageCatalog, type Chapter } from './catalog';

export interface StagesState {
  chapters: Chapter[];
  loading: boolean;
  error: string | null;
}

export function useStages(): StagesState {
  const query = useQuery({ queryKey: ['stage-catalog'], queryFn: stageCatalog });
  return {
    chapters: query.data ?? [],
    loading: query.isPending,
    error: query.error ? '스테이지 목록을 불러오지 못했다' : null,
  };
}
