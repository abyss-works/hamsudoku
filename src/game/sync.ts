import { mergeRecords, type ClearRecord } from '../shared/merge';
import type { ClearEntry } from './save';

interface ServerRecord extends ClearRecord {
  stageCode: string;
}

function toRecord(e: ClearEntry): ClearRecord {
  return { bestElapsedSec: e.elapsedSec, attempts: e.attempts, lastClearedAt: e.clearedAt };
}

function toEntry(stageCode: string, r: ClearRecord): ClearEntry {
  return { stageCode, clearedAt: r.lastClearedAt, elapsedSec: r.bestElapsedSec ?? 0, attempts: r.attempts };
}

export async function pushClear(stageCode: string, elapsedSec: number, attemptKey?: string): Promise<boolean> {
  try {
    const res = await fetch('/api/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stageCode, elapsedSec, attemptKey }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function pull(local: ClearEntry[]): Promise<ClearEntry[]> {
  let server: ServerRecord[];
  try {
    const res = await fetch('/api/records');
    if (!res.ok) return local;
    const data = (await res.json()) as { clears?: ServerRecord[] };
    server = data.clears ?? [];
  } catch {
    return local;
  }
  const out = new Map<string, ClearEntry>();
  for (const c of local) out.set(c.stageCode, c);
  for (const s of server) {
    const prev = out.get(s.stageCode);
    const merged = prev
      ? mergeRecords(toRecord(prev), { bestElapsedSec: s.bestElapsedSec, attempts: s.attempts, lastClearedAt: s.lastClearedAt })
      : { bestElapsedSec: s.bestElapsedSec, attempts: s.attempts, lastClearedAt: s.lastClearedAt };
    out.set(s.stageCode, toEntry(s.stageCode, merged));
  }
  return [...out.values()];
}
