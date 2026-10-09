import { useState } from 'react';
import { mergePulled } from '../shared/merge';
import { loadSave, newSave, nextStageId, recordClear, setSound, storeSave, type ClearEntry } from './save';

export function useClears(): {
  clears: Map<string, ClearEntry>;
  best: (code: string) => ClearEntry | undefined;
  record: (stageCode: string, elapsedSec: number) => void;
  replace: (clears: ClearEntry[]) => void;
  mergeIn: (entries: ClearEntry[]) => void;
  reset: () => void;
  resumeId: (catalogIds: string[]) => string | null;
  sound: boolean;
  setSound: (on: boolean) => void;
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

  const toCore = (c: ClearEntry) => ({
    bestElapsedSec: c.elapsedSec,
    attempts: c.attempts,
    lastClearedAt: c.clearedAt,
  });

  const mergeIn = (entries: ClearEntry[]) => {
    setSave((prev) => {
      const out = new Map(prev.clears.map((c) => [c.stageCode, c] as const));
      for (const s of entries) {
        const cur = out.get(s.stageCode);
        const merged = mergePulled(cur ? toCore(cur) : null, toCore(s));
        if (merged) {
          out.set(s.stageCode, {
            stageCode: s.stageCode,
            clearedAt: merged.lastClearedAt,
            elapsedSec: merged.bestElapsedSec ?? 0,
            attempts: merged.attempts,
          });
        }
      }
      const next = { ...prev, clears: [...out.values()], updatedAt: new Date().toISOString() };
      storeSave(next);
      return next;
    });
  };

  const reset = () => {
    setSave((prev) => {
      const next = { ...newSave(), settings: prev.settings };
      storeSave(next);
      return next;
    });
  };

  const setSoundEnabled = (on: boolean) => {
    setSave((prev) => {
      const next = setSound(prev, on);
      storeSave(next);
      return next;
    });
  };

  return {
    clears,
    best: (code: string) => clears.get(code),
    record,
    replace,
    mergeIn,
    reset,
    resumeId: (catalogIds: string[]) => nextStageId(save.clears, catalogIds),
    sound: save.settings.sound,
    setSound: setSoundEnabled,
  };
}
