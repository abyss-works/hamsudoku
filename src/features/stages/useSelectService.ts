import { useState } from 'react';
import type { Chapter, Stage } from './catalog';
export type { Chapter, Stage };
import type { ClearEntry } from '../../platform/storage/save';
import { useDelayedLoading } from '../../ui/useDelayedLoading';
import { selectionModel } from './selectionLogic';

export interface SelectServiceOptions {
  chapters: Chapter[];
  loading: boolean;
  clears: Map<string, ClearEntry>;
  initialChapterId?: string | null;
}

export function useSelectService({ chapters, loading, clears, initialChapterId }: SelectServiceOptions) {
  const [selectedId, setSelectedId] = useState<string | null>(initialChapterId ?? null);
  const { active, chapterTabs, stages } = selectionModel(chapters, selectedId, clears);
  const showLoading = useDelayedLoading(loading);
  const empty = !loading && chapters.length === 0;
  const ready = !loading && chapters.length > 0;
  return { active, chapterTabs, stages, showLoading, empty, ready, setSelectedId };
}
