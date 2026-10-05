import { describe, expect, it } from 'vitest';
import { createMemoryDb } from './db';
import { fetchRecords, issueEntry, submitClear } from './records';

describe('submitClear', () => {
  it('쓴 키 재사용은 거부된다', async () => {
    const db = createMemoryDb();
    const { key } = await issueEntry(db, 'u1', '1-1');
    expect((await submitClear(db, 'u1', { attemptKey: key, elapsedSec: 60 }, 't1')).status).toBe(200);
    expect((await submitClear(db, 'u1', { attemptKey: key, elapsedSec: 60 }, 't2')).status).toBe(403);
  });
  it('오프라인분(키 없음)은 미검증으로만 쌓인다', async () => {
    const db = createMemoryDb();
    expect((await submitClear(db, 'u1', { stageCode: '1-1', elapsedSec: 60 }, 't1')).status).toBe(200);
    expect((await fetchRecords(db, 'u1')).clears).toEqual([]);
  });
  it('세션 없으면 401이다', async () => {
    const db = createMemoryDb();
    expect((await submitClear(db, null, { attemptKey: 'x', elapsedSec: 1 }, 't1')).status).toBe(401);
  });
});
