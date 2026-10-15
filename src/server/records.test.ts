import { describe, expect, it } from 'vitest';
import { createMemoryDb } from './db/memory';
import { fetchRecords, issueEntry, submitClear } from './records';

describe('submitClear', () => {
  it('쓴 키 재사용은 거부된다', async () => {
    const db = createMemoryDb();
    const { key } = await issueEntry(db, 'u1', '1-1');
    expect((await submitClear(db, 'u1', { attemptKey: key, elapsedSec: 60 }, 't1')).status).toBe(200);
    expect((await submitClear(db, 'u1', { attemptKey: key, elapsedSec: 60 }, 't2')).status).toBe(403);
  });
  it('기록 저장이 실패하면 키 소모를 되돌려 재제출을 허용한다', async () => {
    const db = createMemoryDb();
    const { key } = await issueEntry(db, 'u1', '1-1');
    const original = db.recordVerified;
    db.recordVerified = async () => {
      throw new Error('db down');
    };
    await expect(submitClear(db, 'u1', { attemptKey: key, elapsedSec: 60 }, 't1')).rejects.toThrow('db down');
    db.recordVerified = original;
    expect((await submitClear(db, 'u1', { attemptKey: key, elapsedSec: 60 }, 't1')).status).toBe(200);
  });
  it('카탈로그에 없는 코드로는 입장 키를 발급하지 않는다', async () => {
    const db = createMemoryDb();
    expect((await issueEntry(db, 'u1', 'e-1-3')).status).toBe(400);
    expect((await issueEntry(db, 'u1', '9-9')).status).toBe(400);
  });
  it('무한모드 판의 키는 스테이지 제출로 쓸 수 없다', async () => {
    const db = createMemoryDb();
    const a = await db.issueAttempt('u1', 'e-1-3');
    expect((await submitClear(db, 'u1', { attemptKey: a.id, elapsedSec: 60 }, 't1')).status).toBe(403);
    expect((await fetchRecords(db, 'u1')).clears).toEqual([]);
    expect((await db.findAttempt(a.id))?.usedAt).toBeNull();
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
