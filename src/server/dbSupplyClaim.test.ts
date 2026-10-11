import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../prisma/generated/prisma/client';
import { createMemoryDb, createPrismaDb } from './db';

describe('Prisma claimSupplyChunk 동시성 및 Row Lock 검증 (결함 1)', () => {
  it('Prisma claimSupplyChunk는 트랜잭션 내에서 EndlessSupplyJob과 EndlessSupplyChunk에 대해 FOR UPDATE 행 잠금을 획득한다', async () => {
    const executedOps: string[] = [];
    const fakeTx = {
      $queryRaw: async (query: any) => {
        const sql = String(query.strings ? query.strings.join('?') : query);
        executedOps.push(`tx.$queryRaw:${sql.replace(/\s+/g, ' ').trim()}`);
        return [];
      },
      endlessSupplyJob: {
        findUnique: async () => ({
          id: 'job-1',
          seedStart: 10000,
          targetCount: 10,
          leaseExpiresAt: null,
          status: 'pending',
        }),
        update: async () => {
          executedOps.push('tx.endlessSupplyJob.update');
          return {};
        },
      },
      endlessSupplyChunk: {
        findUnique: async () => ({
          id: 'job-1:0',
          jobId: 'job-1',
          chunkIndex: 0,
          status: 'pending',
          stageCount: 0,
        }),
        update: async () => {
          executedOps.push('tx.endlessSupplyChunk.update');
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
    const result = await db.claimSupplyChunk('job-1', 0, '2026-10-11T12:00:00.000Z', 120_000);

    expect(result.claimed).toBe(true);
    // FOR UPDATE 쿼리가 트랜잭션 내에서 실행되어 동시 요청 경쟁을 방지해야 한다
    const rowLockOps = executedOps.filter((op) => op.includes('FOR UPDATE'));
    expect(rowLockOps.length).toBeGreaterThanOrEqual(1);
    expect(rowLockOps.some((op) => op.includes('EndlessSupplyJob') && op.includes('FOR UPDATE'))).toBe(true);
    expect(rowLockOps.some((op) => op.includes('EndlessSupplyChunk') && op.includes('FOR UPDATE'))).toBe(true);
  });

  it('동시 두 요청이 claimSupplyChunk를 호출할 때 정확히 하나만 claimed: true를 얻고 나머지는 CLAIM_BUSY가 된다', async () => {
    const db = createMemoryDb();
    const jobId = 'job-concurrent-claim';
    await db.createSupplyJob({
      id: jobId,
      policyVersion: 'v1',
      seedStart: 10000,
      seedEnd: 10010,
      targetCount: 10,
      leaseExpiresAt: null,
    });
    await db.createSupplyChunk({
      id: `${jobId}:0`,
      jobId,
      chunkIndex: 0,
      status: 'pending',
    });

    const nowIso = '2026-10-11T12:00:00.000Z';
    const [res1, res2] = await Promise.all([
      db.claimSupplyChunk(jobId, 0, nowIso, 120_000),
      db.claimSupplyChunk(jobId, 0, nowIso, 120_000),
    ]);

    const claimedCount = [res1, res2].filter((r) => r.claimed).length;
    const busyCount = [res1, res2].filter((r) => !r.claimed && r.reason === 'CLAIM_BUSY').length;

    expect(claimedCount).toBe(1);
    expect(busyCount).toBe(1);
  });
});
