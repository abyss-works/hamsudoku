export interface ClearRecord {
  bestElapsedSec: number | null;
  attempts: number;
  lastClearedAt: string;
}

export function mergeClear(
  prev: ClearRecord | null,
  elapsedSec: number,
  atIso: string,
): ClearRecord {
  if (!prev) return { bestElapsedSec: elapsedSec, attempts: 1, lastClearedAt: atIso };
  return {
    bestElapsedSec:
      prev.bestElapsedSec === null ? elapsedSec : Math.min(prev.bestElapsedSec, elapsedSec),
    attempts: prev.attempts + 1,
    lastClearedAt: prev.lastClearedAt > atIso ? prev.lastClearedAt : atIso,
  };
}

export function mergeRecords(a: ClearRecord, b: ClearRecord): ClearRecord {
  return {
    bestElapsedSec:
      a.bestElapsedSec === null
        ? b.bestElapsedSec
        : b.bestElapsedSec === null
          ? a.bestElapsedSec
          : Math.min(a.bestElapsedSec, b.bestElapsedSec),
    attempts: a.attempts + b.attempts,
    lastClearedAt: a.lastClearedAt > b.lastClearedAt ? a.lastClearedAt : b.lastClearedAt,
  };
}
