import { useState } from 'react';
import type { Chapter, Stage } from './stagesApi';
import type { ClearEntry } from '../../platform/storage/save';
import { useDelayedLoading } from '../../ui/useDelayedLoading';
import { selectionModel } from './selectionLogic';
export interface SelectScreenProps {
  chapters: Chapter[];
  loading: boolean;
  error: string | null;
  clears: Map<string, ClearEntry>;
  initialChapterId?: string | null;
  onSelect: (stage: Stage) => void;
  onBack: () => void;
}
export function useSelectService({ chapters, loading, clears, initialChapterId }: SelectScreenProps) {
  const [selectedId, setSelectedId] = useState<string | null>(initialChapterId ?? null);
  const { active, stages } = selectionModel(chapters, selectedId, clears);
  const showLoading = useDelayedLoading(loading);
  return { active, stages, showLoading, setSelectedId };
}
