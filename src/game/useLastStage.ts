import { useState } from 'react';
import { loadLastStageId, saveLastStageId } from './progress';

export function useLastStage(): [string | null, (id: string) => void] {
  const [lastId, setLastId] = useState<string | null>(loadLastStageId);

  const save = (id: string) => {
    saveLastStageId(id);
    setLastId(id);
  };

  return [lastId, save];
}
