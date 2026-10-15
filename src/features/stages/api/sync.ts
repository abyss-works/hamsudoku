import { mergeClearEntries } from '../../../shared/clearEntries';
import type { ClearEntry } from '../../../platform/storage/save';

export type PushResult = 'ok' | 'offline' | 'unauthorized';

interface ServerRecord {
  stageCode: string;
  bestElapsedSec: number | null;
  attempts: number;
  lastClearedAt: string;
}

async function postClear(body: unknown): Promise<Response> {
  return fetch('/api/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchAttemptKey(stageCode: string): Promise<string | undefined> {
  try {
    const res = await fetch('/api/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stageCode }),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { attemptKey?: string };
    return data.attemptKey;
  } catch {
    return undefined;
  }
}

export async function pushClear(stageCode: string, elapsedSec: number, attemptKey?: string): Promise<PushResult> {
  try {
    const res = await postClear({ stageCode, elapsedSec, attemptKey });
    if (res.status === 401) return 'unauthorized';
    return res.ok ? 'ok' : 'offline';
  } catch {
    return 'offline';
  }
}

async function fetchServerRecords(): Promise<{ status: 200 | 401; clears: ServerRecord[] }> {
  const res = await fetch('/api/records');
  if (res.status === 401) return { status: 401, clears: [] };
  if (!res.ok) throw new Error(`records ${res.status}`);
  const data = (await res.json()) as { clears?: ServerRecord[] };
  return { status: 200, clears: data.clears ?? [] };
}

// 조회 결과 계약. failed는 네트워크·서버 실패로 clears가 로컬 입력 그대로임을 뜻하며,
// 호출자는 이 결과로 저장 데이터를 교체하지 않는다.
export interface PullResult {
  clears: ClearEntry[];
  unauthorized: boolean;
  failed: boolean;
}

export async function pull(local: ClearEntry[]): Promise<PullResult> {
  let server: ServerRecord[];
  try {
    const r = await fetchServerRecords();
    if (r.status === 401) return { clears: local, unauthorized: true, failed: false };
    server = r.clears;
  } catch {
    return { clears: local, unauthorized: false, failed: true };
  }
  return { clears: mergeClearEntries(local, server), unauthorized: false, failed: false };
}

// 화해: 서버에 없는 로컬 기록을 미검증으로 밀어올린 뒤 합친다.
// isActive는 각 전송 직전에 호출자의 계정 컨텍스트가 유효한지 확인한다. 세션이 바뀐 뒤의
// 전송은 다른 계정으로 기록되므로 중단하고 실패로 돌려 병합에 쓰이지 않게 한다.
export async function reconcile(local: ClearEntry[], isActive: () => boolean = () => true): Promise<PullResult> {
  let server: ServerRecord[];
  try {
    const r = await fetchServerRecords();
    if (r.status === 401) return { clears: local, unauthorized: true, failed: false };
    server = r.clears;
  } catch {
    return { clears: local, unauthorized: false, failed: true };
  }
  const seen = new Map(server.map((s) => [s.stageCode, s.lastClearedAt] as const));
  for (const c of local) {
    const at = seen.get(c.stageCode);
    if (at === undefined || at < c.clearedAt) {
      if (!isActive()) return { clears: local, unauthorized: false, failed: true };
      try {
        await postClear({ stageCode: c.stageCode, elapsedSec: c.elapsedSec });
      } catch {
        // 못 올린 건 다음 부팅에 다시 시도한다
      }
    }
  }
  if (!isActive()) return { clears: local, unauthorized: false, failed: true };
  return { clears: mergeClearEntries(local, server), unauthorized: false, failed: false };
}

