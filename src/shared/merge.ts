export interface ClearRecord {
  bestElapsedSec: number | null;
  attempts: number;
  lastClearedAt: string;
}

function validBest(n: number | null): number | null {
  return n !== null && n > 0 ? n : null;
}

function minBest(...ns: (number | null)[]): number | null {
  let best: number | null = null;
  for (const n of ns) {
    const v = validBest(n);
    if (v !== null && (best === null || v < best)) best = v;
  }
  return best;
}

function maxTime(a: string, b: string): string {
  return a > b ? a : b;
}

export function mergeClear(
  prev: ClearRecord | null,
  elapsedSec: number,
  atIso: string,
): ClearRecord {
  if (!prev) return { bestElapsedSec: validBest(elapsedSec), attempts: 1, lastClearedAt: atIso };
  return {
    bestElapsedSec: minBest(prev.bestElapsedSec, elapsedSec),
    attempts: prev.attempts + 1,
    lastClearedAt: maxTime(prev.lastClearedAt, atIso),
  };
}

export function mergeRecords(a: ClearRecord, b: ClearRecord): ClearRecord {
  return {
    bestElapsedSec: minBest(a.bestElapsedSec, b.bestElapsedSec),
    attempts: a.attempts + b.attempts,
    lastClearedAt: maxTime(a.lastClearedAt, b.lastClearedAt),
  };
}

// 끌어오기 병합: 같은 사건의 양쪽 사본이라 attempts는 max, 베스트·시각은 mergeRecords와 같다.
export function mergePulled(local: ClearRecord | null, server: ClearRecord | null): ClearRecord | null {
  if (!local) return server;
  if (!server) return local;
  return {
    bestElapsedSec: minBest(local.bestElapsedSec, server.bestElapsedSec),
    attempts: Math.max(local.attempts, server.attempts),
    lastClearedAt: maxTime(local.lastClearedAt, server.lastClearedAt),
  };
}
