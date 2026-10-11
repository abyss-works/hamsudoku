import { mergePulled, type ClearRecord } from './merge';
import type { ClearEntry } from './saveTypes';

export interface ServerClearEntry extends ClearRecord {
  stageCode: string;
}

export function mergeClearEntries(local: ClearEntry[], server: ServerClearEntry[]): ClearEntry[] {
  const out = new Map(local.map((entry) => [entry.stageCode, entry]));
  for (const entry of server) {
    const prev = out.get(entry.stageCode);
    const base = prev ? {
      bestElapsedSec: prev.elapsedSec,
      attempts: prev.attempts,
      lastClearedAt: prev.clearedAt,
    } : null;
    const merged = mergePulled(base, entry);
    if (merged) {
      out.set(entry.stageCode, {
        stageCode: entry.stageCode,
        elapsedSec: merged.bestElapsedSec ?? 0,
        attempts: merged.attempts,
        clearedAt: merged.lastClearedAt,
      });
    }
  }
  return [...out.values()];
}

export function asServerClear(entry: ClearEntry): ServerClearEntry {
  return {
    stageCode: entry.stageCode,
    bestElapsedSec: entry.elapsedSec,
    attempts: entry.attempts,
    lastClearedAt: entry.clearedAt,
  };
}
