import { useState } from 'react';
import { loadSave, nextStageId, recordClear, storeSave, type ClearEntry } from './save';

export function useClears(): {
  clears: Map<string, ClearEntry>;
  best: (code: string) => ClearEntry | undefined;
  record: (stageCode: string, elapsedSec: number) => void;
  replace: (clears: ClearEntry[]) => void;
  resumeId: (catalogIds: string[]) => string | null;
} {
  const [save, setSave] = useState(loadSave);

  const record = (stageCode: string, elapsedSec: number) => {
    setSave((prev) => {
      const next = recordClear(prev, stageCode, elapsedSec, new Date().toISOString());
      storeSave(next);
      return next;
    });
  };

  const clears = new Map(save.clears.map((c) => [c.stageCode, c] as const));

  const replace = (next: ClearEntry[]) => {
    setSave((prev) => {
      const merged = { ...prev, clears: next, updatedAt: new Date().toISOString() };
      storeSave(merged);
      return merged;
    });
  };

  return {
    clears,
    best: (code: string) => clears.get(code),
    record,
    replace,
    resumeId: (catalogIds: string[]) => nextStageId(save.clears, catalogIds),
  };
}
