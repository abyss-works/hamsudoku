import { describe, expect, it } from 'vitest';
import { createMemoryDb } from './db';

describe('DbPort', () => {
  it('쓴 키는 재사용이 안 된다', async () => {
    const db = createMemoryDb();
    const a = await db.issueAttempt('u1', '1-1');
    expect(await db.useAttempt('u1', a.id, '1-1', 't1')).toBeTruthy();
    expect(await db.useAttempt('u1', a.id, '1-1', 't2')).toBeNull();
  });
  it('남의 키는 못 쓴다', async () => {
    const db = createMemoryDb();
    const a = await db.issueAttempt('u1', '1-1');
    expect(await db.useAttempt('u2', a.id, '1-1', 't1')).toBeNull();
  });
  it('미검증은 기록을 안 건드린다', async () => {
    const db = createMemoryDb();
    await db.recordUnverified('u1', '1-1', 60, 't1');
    expect((await db.listRecords('u1')).clears).toEqual([]);
  });
  it('같은 스테이지 2건은 베스트 min·attempts 합으로 합쳐진다', async () => {
    const db = createMemoryDb();
    await db.recordVerified('u1', '1-1', 90, 't1');
    await db.recordVerified('u1', '1-1', 60, 't2');
    expect((await db.listRecords('u1')).clears[0]).toMatchObject({ bestElapsedSec: 60, attempts: 2 });
  });
  it('ensureUser는 유저와 프로필 자리를 만든다', async () => {
    const db = createMemoryDb();
    await db.ensureUser('u1', 'e@x.y');
    expect(await db.listUsers()).toEqual([{ userId: 'u1', email: 'e@x.y', hasProfile: true }]);
  });
  it('ensureUser는 이메일 null로 기존 메일을 지우지 않는다', async () => {
    const db = createMemoryDb();
    await db.ensureUser('u1', 'e@x.y');
    await db.ensureUser('u1', null);
    expect(await db.listUsers()).toEqual([{ userId: 'u1', email: 'e@x.y', hasProfile: true }]);
  });
});
