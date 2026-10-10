import { z } from 'zod';
import { newSave } from '../shared/saveRules';

import type { SaveV1 } from '../shared/saveTypes';
export type { ClearEntry, SaveV1 } from '../shared/saveTypes';
export const SAVE_KEY = 'hamsudoku:save:v1';

const ClearEntrySchema = z.object({
  stageCode: z.string(),
  clearedAt: z.string(),
  elapsedSec: z.number(),
  attempts: z.number(),
});

const SaveSchema = z.object({
  v: z.literal(1),
  clears: z.array(ClearEntrySchema),
  settings: z.object({ sound: z.boolean(), vibration: z.boolean() }),
  updatedAt: z.string(),
});

export { newSave } from '../shared/saveRules';
export function loadSave(): SaveV1 {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return newSave();
    const parsed = SaveSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) throw new Error('invalid save');
    return parsed.data;
  } catch {
    return recover();
  }
}

function recover(): SaveV1 {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) localStorage.setItem(`hamsudoku:save:corrupt:${Date.now()}`, raw);
  } catch {
    // 백업 실패는 무시한다
  }
  const next = newSave();
  storeSave(next);
  return next;
}

export function storeSave(s: SaveV1): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    // 저장 실패는 무시 (프라이빗 모드 등)
  }
}

export { recordClear, nextStageId, setSound } from '../shared/saveRules';
