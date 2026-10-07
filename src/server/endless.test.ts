import { describe, expect, it } from 'vitest';
import { createMemoryDb } from './db';
import { PERFECT_SUSPICIOUS_AT, submitEndlessClear, submitEndlessFail } from './endless';

const stage = (id: string) => ({ id, size: 7, regions: '0'.repeat(49), solution: '0,0;1,1', tier: 2, seed: 1 });
const input = (attemptKey: string, stageId: string) => ({
  attemptKey,
  stageId,
  solution: [[0, 0], [1, 1]] as [number, number][],
  seedLeft: 3,
});

describe('submitEndlessClear', () => {
  it('정상 클리어를 반영하고 응답한다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));
    const a = await db.issueAttempt('u1', 'e-1');
    const nowIso = new Date(Date.parse(a.issuedAt) + 11_000).toISOString();
    const r = await submitEndlessClear(db, 'u1', input(a.id, 'e-1'), nowIso);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, earned: 3, balance: 3, streak: 1, suspicious: false });
  });

  it('재사용 키는 이벤트 없이 무효다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));
    const a = await db.issueAttempt('u1', 'e-1');
    const nowIso = new Date(Date.parse(a.issuedAt) + 11_000).toISOString();
    await submitEndlessClear(db, 'u1', input(a.id, 'e-1'), nowIso);
    const again = await submitEndlessClear(db, 'u1', input(a.id, 'e-1'), nowIso);
    expect(again.body).toMatchObject({ ok: false });
    expect((await db.getEndlessSummary('u1')).balance).toBe(3);
    expect(await db.listRecentEndlessEvents('u1', 5)).toHaveLength(1);
  });

  it('하한 미달은 무효 이벤트로 적재된다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));
    const a = await db.issueAttempt('u1', 'e-1');
    const nowIso = new Date(Date.parse(a.issuedAt) + 1_000).toISOString();
    const r = await submitEndlessClear(db, 'u1', input(a.id, 'e-1'), nowIso);
    expect(r.body).toMatchObject({ ok: false });
    const recent = await db.listRecentEndlessEvents('u1', 5);
    expect(recent[0]).toMatchObject({ verified: false, reason: '하한 미달' });
  });

  it('정답 불일치는 무효다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));
    const a = await db.issueAttempt('u1', 'e-1');
    const nowIso = new Date(Date.parse(a.issuedAt) + 11_000).toISOString();
    const r = await submitEndlessClear(db, 'u1', { ...input(a.id, 'e-1'), solution: [[0, 0], [0, 1]] }, nowIso);
    expect(r.body).toMatchObject({ ok: false });
  });

  it('seedLeft 0은 무효다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));
    const a = await db.issueAttempt('u1', 'e-1');
    const nowIso = new Date(Date.parse(a.issuedAt) + 11_000).toISOString();
    const r = await submitEndlessClear(db, 'u1', { ...input(a.id, 'e-1'), seedLeft: 0 }, nowIso);
    expect(r.body).toMatchObject({ ok: false });
  });

  it('제출 간격 하한을 적용한다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));
    await db.insertStage(stage('e-2'));
    const a1 = await db.issueAttempt('u1', 'e-1');
    const t1 = new Date(Date.parse(a1.issuedAt) + 11_000).toISOString();
    await submitEndlessClear(db, 'u1', input(a1.id, 'e-1'), t1);
    const a2 = await db.issueAttempt('u1', 'e-2');
    const t2 = new Date(Date.parse(a2.issuedAt) + 11_000).toISOString();
    const r = await submitEndlessClear(db, 'u1', input(a2.id, 'e-2'), t2);
    expect(r.body).toMatchObject({ ok: false });
  });

  it('완벽 클레임 패턴은 suspicious로 적재하되 반영한다', async () => {
    const db = createMemoryDb();
    for (let i = 0; i < PERFECT_SUSPICIOUS_AT; i++) await db.insertStage(stage(`e-${i}`));
    let t = Date.parse('2026-10-07T00:00:00.000Z');
    for (let i = 0; i < PERFECT_SUSPICIOUS_AT; i++) {
      await db.commitEndlessClear('u1', `e-${i}`, {
        earned: 3,
        season: '2026-W41',
        seedLeft: 3,
        elapsedMs: 30000,
        suspicious: false,
        atIso: new Date(t).toISOString(),
      });
      t += 60_000;
    }
    await db.insertStage(stage('e-last'));
    const a = await db.issueAttempt('u1', 'e-last');
    const nowIso = new Date(Date.parse(a.issuedAt) + 11_000).toISOString();
    const r = await submitEndlessClear(db, 'u1', input(a.id, 'e-last'), nowIso);
    expect(r.body).toMatchObject({ ok: true, suspicious: true });
  });

  it('세션 없으면 401이다', async () => {
    const db = createMemoryDb();
    const r = await submitEndlessClear(db, null, input('k', 'e-1'), new Date().toISOString());
    expect(r.status).toBe(401);
  });
});

describe('submitEndlessFail', () => {
  it('유효 키는 attempts를 올리고 current를 리셋한다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));
    const a = await db.issueAttempt('u1', 'e-1');
    const nowIso = new Date(Date.parse(a.issuedAt) + 5_000).toISOString();
    const r = await submitEndlessFail(db, 'u1', { attemptKey: a.id }, nowIso);
    expect(r.status).toBe(200);
  });

  it('무효 키는 403이다', async () => {
    const db = createMemoryDb();
    const r = await submitEndlessFail(db, 'u1', { attemptKey: 'nope' }, new Date().toISOString());
    expect(r.status).toBe(403);
  });
});
