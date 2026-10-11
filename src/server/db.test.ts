import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../prisma/generated/prisma/client';
import { createMemoryDb, createPrismaDb } from './db';

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

  it('시즌 적립을 사용자별로 합산한다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));
    await db.insertStage(stage('e-2'));
    await db.commitEndlessClear('u1', 'e-1', { earned: 3, season: '2026-W41', seedLeft: 3, elapsedMs: 30000, suspicious: false, atIso: '2026-10-07T00:00:00.000Z' });
    await db.commitEndlessClear('u1', 'e-2', { earned: 2, season: '2026-W41', seedLeft: 2, elapsedMs: 30000, suspicious: false, atIso: '2026-10-07T00:01:00.000Z' });
    await db.commitEndlessClear('u2', 'e-1', { earned: 1, season: '2026-W40', seedLeft: 1, elapsedMs: 30000, suspicious: false, atIso: '2026-10-07T00:02:00.000Z' });
    expect(await db.listSeasonEarnings('2026-W41')).toEqual([{ userId: 'u1', amount: 5 }]);
  });

  it('commitEndlessClear는 stage의 plays, clears, clearTotalMs, avgClearMs를 트랜잭션에서 갱신한다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));
    await db.commitEndlessClear('u1', 'e-1', { earned: 3, season: '2026-W41', seedLeft: 3, elapsedMs: 20000, suspicious: false, atIso: '2026-10-07T00:00:00.000Z' });
    const s1 = await db.getStage('e-1');
    expect(s1).toMatchObject({ plays: 1, clears: 1, clearTotalMs: BigInt(20000), avgClearMs: 20000 });

    await db.commitEndlessClear('u2', 'e-1', { earned: 3, season: '2026-W41', seedLeft: 3, elapsedMs: 40000, suspicious: false, atIso: '2026-10-07T00:01:00.000Z' });
    const s2 = await db.getStage('e-1');
    expect(s2).toMatchObject({ plays: 2, clears: 2, clearTotalMs: BigInt(60000), avgClearMs: 30000 });
  });

  it('commitEndlessFail은 plays만 증가시키고 clears, avgClearMs는 변경하지 않는다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));
    await db.commitEndlessClear('u1', 'e-1', { earned: 3, season: '2026-W41', seedLeft: 3, elapsedMs: 20000, suspicious: false, atIso: '2026-10-07T00:00:00.000Z' });
    await db.commitEndlessFail('u2', 'e-1', '2026-10-07T00:01:00.000Z');
    const s = await db.getStage('e-1');
    expect(s).toMatchObject({ plays: 2, clears: 1, clearTotalMs: BigInt(20000), avgClearMs: 20000 });
  });

  it('countZeroClearStages는 clears가 0인 스테이지 수만 센다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));
    await db.insertStage(stage('e-2'));
    expect(await db.countZeroClearStages()).toBe(2);
    await db.commitEndlessClear('u1', 'e-1', { earned: 3, season: '2026-W41', seedLeft: 3, elapsedMs: 20000, suspicious: false, atIso: '2026-10-07T00:00:00.000Z' });
    expect(await db.countZeroClearStages()).toBe(1);
    await db.commitEndlessClear('u1', 'e-2', { earned: 3, season: '2026-W41', seedLeft: 3, elapsedMs: 20000, suspicious: false, atIso: '2026-10-07T00:00:00.000Z' });
    expect(await db.countZeroClearStages()).toBe(0);
  });

  it('동일 사용자의 중복 클리어 제출 시 보상 지급과 스테이지 클리어 통계가 중복 가산되지 않는다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));

    // 첫 번째 클리어: 정상 보상 및 통계 반영
    const s1 = await db.commitEndlessClear('u1', 'e-1', {
      earned: 3,
      season: '2026-W41',
      seedLeft: 3,
      elapsedMs: 20000,
      suspicious: false,
      atIso: '2026-10-07T00:00:00.000Z',
    });
    expect(s1.balance).toBe(3);
    expect(s1.clearedCount).toBe(1);

    const st1 = await db.getStage('e-1');
    expect(st1?.clears).toBe(1);
    expect(st1?.plays).toBe(1);

    // 중복 클리어 제출 (네트워크 재전송 또는 중복 요청)
    const s2 = await db.commitEndlessClear('u1', 'e-1', {
      earned: 3,
      season: '2026-W41',
      seedLeft: 3,
      elapsedMs: 25000,
      suspicious: false,
      atIso: '2026-10-07T00:00:10.000Z',
    });
    // 보상 및 클리어 수 중복 증가 방지
    expect(s2.balance).toBe(3);
    expect(s2.clearedCount).toBe(1);

    const st2 = await db.getStage('e-1');
    expect(st2?.clears).toBe(1);
    expect(st2?.plays).toBe(1);
    expect(st2?.clearTotalMs).toBe(BigInt(20000));
  });

  it('Int 및 BigInt 상한을 초과하는 대규모 경과 시간에 대해 오버플로 없이 상한값으로 안전하게 클램핑된다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));

    // 32비트 부호 있는 정수 상한(2,147,483,647)을 초과하는 큰 밀리초 경과 시간
    await db.commitEndlessClear('u1', 'e-1', {
      earned: 1,
      season: '2026-W41',
      seedLeft: 3,
      elapsedMs: 3_000_000_000,
      suspicious: false,
      atIso: '2026-10-07T00:00:00.000Z',
    });

    const st = await db.getStage('e-1');
    expect(st?.avgClearMs).toBe(2_147_483_647);
  });

  it('동시 클리어 요청 시 가산 손실 없이 plays, clears, clearTotalMs가 원자적으로 누적된다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));

    await Promise.all([
      db.commitEndlessClear('u1', 'e-1', {
        earned: 1,
        season: '2026-W41',
        seedLeft: 3,
        elapsedMs: 10000,
        suspicious: false,
        atIso: '2026-10-07T00:00:00.000Z',
      }),
      db.commitEndlessClear('u2', 'e-1', {
        earned: 1,
        season: '2026-W41',
        seedLeft: 3,
        elapsedMs: 20000,
        suspicious: false,
        atIso: '2026-10-07T00:00:01.000Z',
      }),
      db.commitEndlessClear('u3', 'e-1', {
        earned: 1,
        season: '2026-W41',
        seedLeft: 3,
        elapsedMs: 30000,
        suspicious: false,
        atIso: '2026-10-07T00:00:02.000Z',
      }),
    ]);

    const st = await db.getStage('e-1');
    expect(st?.plays).toBe(3);
    expect(st?.clears).toBe(3);
    expect(st?.clearTotalMs).toBe(BigInt(60000));
    expect(st?.avgClearMs).toBe(20000);
  });
});

describe('ensureUser 경합', () => {
  const conflict = () => Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });

  function stubClient(behavior: { upsert: () => Promise<unknown> }): { client: PrismaClient; calls: { update: number } } {
    const calls = { update: 0 };
    const client = {
      user: {
        upsert: behavior.upsert,
        update: async () => {
          calls.update += 1;
          return {};
        },
        findUnique: async () => null,
      },
      profile: {
        upsert: async () => ({}),
        findUnique: async () => null,
      },
    } as unknown as PrismaClient;
    return { client, calls };
  }

  it('user upsert 경합(P2002)은 update로 복구하고 던지지 않는다', async () => {
    let first = true;
    const { client, calls } = stubClient({
      upsert: async () => {
        if (first) {
          first = false;
          throw conflict();
        }
        return {};
      },
    });
    const db = createPrismaDb(client);
    await expect(db.ensureUser('u1', 'e@x.y')).resolves.toBeUndefined();
    expect(calls.update).toBe(1);
  });

  it('P2002가 아닌 오류는 그대로 던진다', async () => {
    const { client } = stubClient({
      upsert: async () => {
        throw Object.assign(new Error('boom'), { code: 'P2024' });
      },
    });
    const db = createPrismaDb(client);
    await expect(db.ensureUser('u1', 'e@x.y')).rejects.toThrow('boom');
  });
});
