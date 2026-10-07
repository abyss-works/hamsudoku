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

describe('endless DbPort', () => {
  const stage = (id: string) => ({ id, size: 7, regions: '0'.repeat(49), solution: '0,0', tier: 2, seed: 1 });

  it('안 깬 판을 뽑고 다 깨면 null이다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));
    expect((await db.pickUnclearedStage('u1'))?.id).toBe('e-1');
    await db.commitEndlessClear('u1', 'e-1', { earned: 2, season: '2026-W41', seedLeft: 2, elapsedMs: 30000, suspicious: false, atIso: '2026-10-07T00:00:00.000Z' });
    expect(await db.pickUnclearedStage('u1')).toBeNull();
  });

  it('클리어는 지갑·진행·스트릭을 반영한다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));
    const s = await db.commitEndlessClear('u1', 'e-1', { earned: 3, season: '2026-W41', seedLeft: 3, elapsedMs: 30000, suspicious: false, atIso: '2026-10-07T00:00:00.000Z' });
    expect(s).toMatchObject({ balance: 3, clearedCount: 1, streak: { current: 1, best: 1 } });
  });

  it('비무오답 클리어는 current만 리셋하고 best는 유지한다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));
    await db.insertStage(stage('e-2'));
    await db.commitEndlessClear('u1', 'e-1', { earned: 3, season: '2026-W41', seedLeft: 3, elapsedMs: 30000, suspicious: false, atIso: '2026-10-07T00:00:00.000Z' });
    const s = await db.commitEndlessClear('u1', 'e-2', { earned: 1, season: '2026-W41', seedLeft: 1, elapsedMs: 40000, suspicious: false, atIso: '2026-10-07T00:00:00.000Z' });
    expect(s.streak).toEqual({ current: 0, best: 1 });
  });

  it('실패는 attempts를 올리고 current를 리셋한다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));
    await db.commitEndlessClear('u1', 'e-1', { earned: 3, season: '2026-W41', seedLeft: 3, elapsedMs: 30000, suspicious: false, atIso: '2026-10-07T00:00:00.000Z' });
    const { streak } = await db.commitEndlessFail('u1', 'e-1', '2026-10-07T00:00:00.000Z');
    expect(streak).toEqual({ current: 0, best: 1 });
  });

  it('미검증 이벤트는 반영하지 않는다', async () => {
    const db = createMemoryDb();
    await db.appendEndlessEvent('u1', 'e-1', { seedLeft: 1, elapsedMs: 1000, verified: false, suspicious: false, reason: '하한 미달' });
    const s = await db.getEndlessSummary('u1');
    expect(s).toMatchObject({ balance: 0, clearedCount: 0, streak: { current: 0, best: 0 } });
  });
});
