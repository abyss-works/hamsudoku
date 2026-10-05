import { z } from 'zod';

export interface ClearEntry {
  stageCode: string;
  clearedAt: string;
  elapsedSec: number;
  attempts: number;
}

export interface SaveV1 {
  v: 1;
  clears: ClearEntry[];
  settings: { sound: boolean; vibration: boolean };
  updatedAt: string;
}

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

function fresh(): SaveV1 {
  return { v: 1, clears: [], settings: { sound: true, vibration: true }, updatedAt: new Date(0).toISOString() };
}

export function loadSave(): SaveV1 {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return fresh();
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
  const next = fresh();
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

export function recordClear(s: SaveV1, stageCode: string, elapsedSec: number, nowIso: string): SaveV1 {
  const prev = s.clears.find((c) => c.stageCode === stageCode);
  const entry: ClearEntry = prev
    ? {
        stageCode,
        clearedAt: prev.clearedAt > nowIso ? prev.clearedAt : nowIso,
        elapsedSec: Math.min(prev.elapsedSec, elapsedSec),
        attempts: prev.attempts + 1,
      }
    : { stageCode, clearedAt: nowIso, elapsedSec, attempts: 1 };
  return {
    ...s,
    clears: [...s.clears.filter((c) => c.stageCode !== stageCode), entry],
    updatedAt: nowIso,
  };
}

export function nextStageId(clears: ClearEntry[], catalogIds: string[]): string | null {
  const done = new Set(clears.map((c) => c.stageCode));
  const open = catalogIds.filter((id) => !done.has(id));
  if (open.length === 0) return null;
  const max = [...clears].sort(compareClears).at(-1);
  const after = max ? catalogIds.filter((id) => id > max.stageCode) : [];
  return after.find((id) => open.includes(id)) ?? open[0] ?? null;
}

function compareClears(a: ClearEntry, b: ClearEntry): number {
  if (a.clearedAt !== b.clearedAt) return a.clearedAt < b.clearedAt ? -1 : 1;
  return a.stageCode < b.stageCode ? -1 : 1;
}
