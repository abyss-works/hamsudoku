import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../prisma/generated/prisma/client';
import { createMemoryDb } from './db/memory';
import { createPrismaDb } from './db/prisma';

describe('Prisma 개인 확정 순위 조회', () => {
  it('미확정 시즌은 null을 반환해 개인 원장 조회로 이어진다', async () => {
    const db = createPrismaDb({
      seasonFinalization: { findUnique: async () => null },
      seasonRankResult: { findUnique: async () => null },
    } as unknown as PrismaClient);
    expect(await db.getFinalizedUserRank('2026-W41', 'u1')).toBeNull();
  });
  it('확정 시즌에 참여하지 않은 사용자는 0점과 순위 없음이다', async () => {
    const db = createPrismaDb({
      seasonFinalization: { findUnique: async () => ({ status: 'finalized' }) },
      seasonRankResult: { findUnique: async () => null },
    } as unknown as PrismaClient);
    expect(await db.getFinalizedUserRank('2026-W41', 'u1')).toEqual({ rank: null, score: 0 });
  });
});

describe('Prisma 검증 기록 저장', () => {
  // 두 요청이 같은 이전 행을 읽는 경합을 재현한다. 저장이 읽은 값을 대입하면 attempts가 한 번만 늘고,
  // DB 측 원자 갱신(증가·최솟값·최신 시각)을 사용하면 두 번 늘어난다.
  function stubClient() {
    const row = { bestElapsedSec: 90, attempts: 1, lastClearedAt: new Date('2026-10-01T00:00:00Z') };
    const events: unknown[] = [];
    const client = {
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
      $executeRaw: async (_strings: TemplateStringsArray, ...values: unknown[]) => {
        // 조건부 upsert의 SQL 의미를 흉내 낸다: attempts + 1, LEAST(best), GREATEST(lastClearedAt).
        const [, , best, at] = values as [string, string, number | null, Date];
        row.attempts += 1;
        if (best !== null && (row.bestElapsedSec === null || best < row.bestElapsedSec)) row.bestElapsedSec = best;
        if (at > row.lastClearedAt) row.lastClearedAt = at;
        return 1;
      },
      clearRecord: {
        findUnique: async () => ({ ...row }),
        upsert: async ({ update }: { update: typeof row }) => {
          Object.assign(row, update);
          return row;
        },
      },
      clearEvent: { create: async (arg: unknown) => void events.push(arg) },
    };
    return { client, row, events };
  }

  it('동시 저장 2건은 attempts를 두 번 늘리고 베스트는 최솟값을 유지한다', async () => {
    const { client, row, events } = stubClient();
    const db = createPrismaDb(client as unknown as PrismaClient);
    await Promise.all([
      db.recordVerified('u1', '1-1', 70, '2026-10-02T00:00:00Z'),
      db.recordVerified('u1', '1-1', 50, '2026-10-03T00:00:00Z'),
    ]);
    expect(row.attempts).toBe(3);
    expect(row.bestElapsedSec).toBe(50);
    expect(row.lastClearedAt.toISOString()).toBe('2026-10-03T00:00:00.000Z');
    expect(events).toHaveLength(2);
  });
});

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
    expect(s?.streak).toEqual({ current: 0, best: 1 });
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

  it('동일 사용자가 별도의 유효 시도로 클리어 시 각각 정상 기록되고 보상과 스테이지 통계가 누적된다', async () => {
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
    expect(s1?.balance).toBe(3);
    expect(s1?.clearedCount).toBe(1);

    const st1 = await db.getStage('e-1');
    expect(st1?.clears).toBe(1);
    expect(st1?.plays).toBe(1);

    // 두 번째 유효 클리어 제출: 별도 유효 attempt에 따른 정상 기록
    const s2 = await db.commitEndlessClear('u1', 'e-1', {
      earned: 3,
      season: '2026-W41',
      seedLeft: 3,
      elapsedMs: 25000,
      suspicious: false,
      atIso: '2026-10-07T00:00:10.000Z',
    });
    expect(s2?.balance).toBe(6);
    expect(s2?.clearedCount).toBe(1);

    const st2 = await db.getStage('e-1');
    expect(st2?.clears).toBe(2);
    expect(st2?.plays).toBe(2);
    expect(st2?.clearTotalMs).toBe(BigInt(45000));
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
  it('getUserSeasonRank는 DB 원장 기반으로 점수와 순위를 정확히 계산한다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));
    const window = { startAt: new Date('2026-10-04T19:00:00Z'), endAt: new Date('2026-10-11T15:00:00Z') };
    expect(await db.getUserSeasonRank('2026-W41', 'u-none', window)).toEqual({ rank: null, score: 0 });

    await db.commitEndlessClear('u1', 'e-1', { earned: 3, season: '2026-W41', seedLeft: 3, elapsedMs: 30000, suspicious: false, atIso: '2026-10-07T00:00:00.000Z' });
    await db.commitEndlessClear('u2', 'e-1', { earned: 5, season: '2026-W41', seedLeft: 3, elapsedMs: 30000, suspicious: false, atIso: '2026-10-07T00:00:00.000Z' });
    expect(await db.getUserSeasonRank('2026-W41', 'u1', window)).toEqual({ rank: 2, score: 3 });
    expect(await db.getUserSeasonRank('2026-W41', 'u2', window)).toEqual({ rank: 1, score: 5 });
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

describe('Prisma advisory lock 및 트랜잭션 공유 (결함 1 & 2)', () => {
  it('runWithSeasonLock은 tx에서 advisory lock을 획득하고 tx-bound db를 콜백에 전달하여 쿼리를 tx에 격리한다', async () => {
    const executedOps: string[] = [];
    const fakeTx = {
      $executeRaw: async (_query: any) => {
        executedOps.push('tx.$executeRaw');
        return 1;
      },
      $queryRaw: async (_query: any) => {
        executedOps.push('tx.$queryRaw');
        return [{ userId: 'u1', score: 10 }];
      },
      seasonFinalization: {
        upsert: async () => {
          executedOps.push('tx.seasonFinalization.upsert');
          return {};
        },
      },
      seasonRankResult: {
        createMany: async () => {
          executedOps.push('tx.seasonRankResult.createMany');
          return {};
        },
      },
    };

    const fakeClient = {
      $transaction: async (cb: (tx: any) => Promise<any>) => {
        executedOps.push('client.$transaction:start');
        const res = await cb(fakeTx);
        executedOps.push('client.$transaction:end');
        return res;
      },
    } as unknown as PrismaClient;

    const db = createPrismaDb(fakeClient);
    const result = await db.runWithSeasonLock('2026-W41', async (txDb) => {
      expect(txDb).toBeDefined();
      const aggregated = await txDb.aggregateSeasonLedger('2026-W41', {
        startAt: new Date('2026-10-04T19:00:00Z'),
        endAt: new Date('2026-10-11T15:00:00Z'),
      });
      await txDb.saveSeasonFinalization(
        {
          season: '2026-W41',
          startAt: '2026-10-04T19:00:00.000Z',
          endAt: '2026-10-11T15:00:00.000Z',
          finalizedAt: '2026-10-11T15:01:00.000Z',
          status: 'finalized',
        },
        [{ season: '2026-W41', userId: 'u1', score: 10, rank: 1 }],
      );
      return aggregated;
    });

    expect(result).toEqual([{ userId: 'u1', score: 10 }]);
    expect(executedOps[0]).toBe('client.$transaction:start');
    expect(executedOps[1]).toBe('tx.$executeRaw');
    expect(executedOps[2]).toBe('tx.$queryRaw');
    expect(executedOps[3]).toBe('tx.seasonFinalization.upsert');
    expect(executedOps[4]).toBe('tx.seasonRankResult.createMany');
    expect(executedOps[5]).toBe('client.$transaction:end');
  });

  it('commitEndlessClear는 동일한 시즌 advisory lock을 획득한 후 쓰기를 수행한다', async () => {
    const executedOps: string[] = [];
    const fakeTx = {
      $executeRaw: async (_query: any) => {
        executedOps.push('tx.$executeRaw:lock');
        return 1;
      },
      endlessProgress: {
        upsert: async () => {
          executedOps.push('tx.endlessProgress.upsert');
          return {};
        },
        count: async () => 1,
      },
      seedWallet: {
        upsert: async () => {
          executedOps.push('tx.seedWallet.upsert');
          return { userId: 'u1', balance: 3 };
        },
      },
      seasonFinalization: {
        findUnique: async () => {
          executedOps.push('tx.seasonFinalization.findUnique');
          return null;
        },
      },
      seedLedger: {
        create: async (args: any) => {
          executedOps.push('tx.seedLedger.create');
          return args.data;
        },
      },
      endlessStreak: {
        findUnique: async () => null,
        upsert: async () => ({ current: 1, best: 1 }),
      },
      endlessEvent: {
        create: async () => ({}),
      },
    };

    const fakeClient = {
      $transaction: async (cb: (tx: any) => Promise<any>) => {
        executedOps.push('client.$transaction:start');
        return cb(fakeTx);
      },
    } as unknown as PrismaClient;

    const db = createPrismaDb(fakeClient);
    await db.commitEndlessClear('u1', 'e-1', {
      earned: 3,
      season: '2026-W41',
      seedLeft: 3,
      elapsedMs: 20000,
      suspicious: false,
      atIso: '2026-10-06T10:00:00.000Z',
    });

    expect(executedOps[0]).toBe('client.$transaction:start');
    expect(executedOps[1]).toBe('tx.$executeRaw:lock');
    expect(executedOps[2]).toBe('tx.endlessProgress.upsert');
  });

  it('최종 확정 후 클리어도 지갑을 증가시키고 SeedLedger를 항상 저장하되 rankingEligible은 false로 기록한다', async () => {
    const db = createMemoryDb();
    // 2026-W41 시즌 확정 저장
    await db.saveSeasonFinalization(
      {
        season: '2026-W41',
        startAt: '2026-10-04T19:00:00.000Z',
        endAt: '2026-10-11T15:00:00.000Z',
        finalizedAt: '2026-10-11T15:01:00.000Z',
        status: 'finalized',
      },
      [{ season: '2026-W41', userId: 'user-early', score: 3, rank: 1 }],
    );

    // 확정 이후에 늦게 도착한 클리어
    const res = await db.commitEndlessClear('user-late', 'e-1', {
      earned: 3,
      season: '2026-W41',
      seedLeft: 3,
      elapsedMs: 20000,
      suspicious: false,
      atIso: '2026-10-11T15:05:00.000Z',
    });

    expect(res?.balance).toBe(3);
    const summary = await db.getEndlessSummary('user-late');
    expect(summary.balance).toBe(3);

    // 원장 목록에 지갑 획득 사실이 보존되어야 한다
    const rawLedger = (db as any).getRawSeedLedger ? (db as any).getRawSeedLedger() : [];
    const lateRow = rawLedger.find((r: any) => r.userId === 'user-late');
    expect(lateRow).toBeDefined();
    expect(lateRow.amount).toBe(3);
    expect(lateRow.rankingEligible).toBe(false);

    // 하지만 랭킹 점수 집계에는 늦은 제출이 포함되지 않는다
    const agg = await db.aggregateSeasonLedger('2026-W41', {
      startAt: new Date('2026-10-04T19:00:00.000Z'),
      endAt: new Date('2026-10-11T15:00:00.000Z'),
    });
    expect(agg.find((r) => r.userId === 'user-late')).toBeUndefined();
  });
});

