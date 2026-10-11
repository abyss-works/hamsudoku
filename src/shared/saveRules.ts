import type { ClearEntry, SaveV1 } from './saveTypes';
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

export function setSound(s: SaveV1, on: boolean, nowIso: string): SaveV1 {
  return { ...s, settings: { ...s.settings, sound: on }, updatedAt: nowIso };
}

export function nextStageId(clears: ClearEntry[], catalogIds: string[]): string | null {
  const done = new Set(clears.map((c) => c.stageCode));
  const open = catalogIds.filter((id) => !done.has(id));
  if (open.length === 0) return null;
  const max = [...clears].sort(compareClears).at(-1);
  const after = max ? catalogIds.filter((id) => compareStageCode(id, max.stageCode) > 0) : [];
  return after.find((id) => open.includes(id)) ?? open[0] ?? null;
}

function compareStageCode(a: string, b: string): number {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  if (pa.length === 2 && pb.length === 2 && pa.every(Number.isInteger) && pb.every(Number.isInteger)) {
    return pa[0] - pb[0] || pa[1] - pb[1];
  }
  return a < b ? -1 : 1;
}

function compareClears(a: ClearEntry, b: ClearEntry): number {
  if (a.clearedAt !== b.clearedAt) return a.clearedAt < b.clearedAt ? -1 : 1;
  return compareStageCode(a.stageCode, b.stageCode);
}

export function newSave(): SaveV1 {
  return { v: 1, clears: [], settings: { sound: true, vibration: true }, updatedAt: '1970-01-01T00:00:00.000Z' };
}
