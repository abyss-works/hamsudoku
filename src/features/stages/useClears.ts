import { useRef, useState } from 'react';
import { saveApi } from '../../platform/storage/saveApi';
import { asServerClear, mergeClearEntries } from '../../shared/clearEntries';
import { newSave, nextStageId, recordClear, setSound } from '../../shared/saveRules';
import type { ClearEntry, SaveV1 } from '../../shared/saveTypes';

export function useClears() {
  const [save, setSave] = useState(saveApi.read);
  const current = useRef(save);
  const commit = (next: SaveV1) => {
    current.current = next;
    saveApi.write(next);
    setSave(next);
  };
  const now = () => new Date().toISOString();
  const clears = new Map(save.clears.map((entry) => [entry.stageCode, entry] as const));
  return {
    clears,
    best: (code: string) => clears.get(code),
    record: (stageCode: string, elapsedSec: number) => {
      commit(recordClear(current.current, stageCode, elapsedSec, now()));
    },
    replace: (entries: ClearEntry[]) => commit({ ...current.current, clears: entries, updatedAt: now() }),
    mergeIn: (entries: ClearEntry[]) => commit({
      ...current.current,
      clears: mergeClearEntries(current.current.clears, entries.map(asServerClear)),
      updatedAt: now(),
    }),
    reset: () => commit({ ...newSave(), settings: current.current.settings }),
    resumeId: (catalogIds: string[]) => nextStageId(save.clears, catalogIds),
    sound: save.settings.sound,
    setSound: (on: boolean) => commit(setSound(current.current, on, now())),
  };
}
