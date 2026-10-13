import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../prisma/generated/prisma/client';
import { createMemoryDb } from './db/memory';
import { createPrismaDb } from './db/prisma';
import type { EndlessStageRow } from './db/port';

function dummyStage(id: string, seed: number): EndlessStageRow {
  return {
    id,
    size: 7,
    regions: '[[[0,0]]]',
    solution: '[[1]]',
    tier: 1,
    seed,
    plays: 0,
    clears: 0,
    avgClearMs: 0,
    clearTotalMs: BigInt(0),
  };
}

describe('청크 임대 소유권 (fencing token) 및 완료 상태 보호 검증 (결함 2)', () => {
  it('완료된 청크(completed)에 대한 지연된 failSupplyChunk 호출은 상태를 failed로 변경하지 못한다', async () => {
    const db = createMemoryDb();
    const jobId = 'job-completed-protect';
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

    const claim = await db.claimSupplyChunk(jobId, 0, '2026-10-11T12:00:00.000Z', 120_000);
    expect(claim.claimed).toBe(true);
    expect(claim.claimToken).toBeDefined();

    const stages = Array.from({ length: 10 }, (_, i) => dummyStage(`st-${i}`, 10000 + i));
    const inserted = await db.insertSupplyBatch(jobId, 0, stages, '2026-10-11T12:01:00.000Z', claim.claimToken);
    expect(inserted).toBe(true);

    const chunkBefore = await db.findSupplyChunk(jobId, 0);
    expect(chunkBefore?.status).toBe('completed');

    // 오래된/지연된 실패 호출 발생
    await db.failSupplyChunk(jobId, 0, 'STALE_FAILURE', claim.claimToken);

    // 완료된 상태가 유지되어야 한다 (failed로 변경 불가)
    const chunkAfter = await db.findSupplyChunk(jobId, 0);
    expect(chunkAfter?.status).toBe('completed');
  });

  it('만료된 이전 실행자의 failSupplyChunk 호출은 신규 실행자의 상태를 덮어쓰지 못한다', async () => {
    const db = createMemoryDb();
    const jobId = 'job-fencing-fail';
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

    // 1. 실행자 1이 claim 획득 (12:00)
    const claim1 = await db.claimSupplyChunk(jobId, 0, '2026-10-11T12:00:00.000Z', 60_000);
    expect(claim1.claimed).toBe(true);
    const token1 = claim1.claimToken;
    expect(token1).toBeDefined();

    // 2. 임대 만료 후(12:02), 신규 실행자 2가 claim 획득
    const claim2 = await db.claimSupplyChunk(jobId, 0, '2026-10-11T12:02:00.000Z', 60_000);
    expect(claim2.claimed).toBe(true);
    const token2 = claim2.claimToken;
    expect(token2).not.toBe(token1);

    // 3. 만료된 이전 실행자 1이 지연된 실패 호출 시도
    await db.failSupplyChunk(jobId, 0, 'OLD_RUNNER_ERROR', token1);

    // 신규 실행자 2의 running 상태 및 임대가 보존되어야 한다
    const chunk = await db.findSupplyChunk(jobId, 0);
    expect(chunk?.status).toBe('running');
    const job = await db.findSupplyJob(jobId);
    expect(job?.status).toBe('running');
  });

  it('만료된 이전 실행자의 insertSupplyBatch 호출은 거부되고 신규 실행자 상태를 덮어쓰지 않는다', async () => {
    const db = createMemoryDb();
    const jobId = 'job-fencing-insert';
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

    // 1. 실행자 1이 claim 획득 (12:00)
    const claim1 = await db.claimSupplyChunk(jobId, 0, '2026-10-11T12:00:00.000Z', 60_000);
    const token1 = claim1.claimToken;

    // 2. 임대 만료 후(12:02), 신규 실행자 2가 claim 획득
    const claim2 = await db.claimSupplyChunk(jobId, 0, '2026-10-11T12:02:00.000Z', 60_000);
    expect(claim2.claimed).toBe(true);

    // 3. 만료된 이전 실행자 1이 적재 시도
    const stages = Array.from({ length: 10 }, (_, i) => dummyStage(`st-old-${i}`, 10000 + i));
    const inserted = await db.insertSupplyBatch(jobId, 0, stages, '2026-10-11T12:03:00.000Z', token1);
    expect(inserted).toBe(false);

    // 신규 실행자 2의 running 상태가 유지되어야 한다
    const chunk = await db.findSupplyChunk(jobId, 0);
    expect(chunk?.status).toBe('running');
  });

  it('Prisma insertSupplyBatch는 트랜잭션 내에서 EndlessSupplyJob 및 EndlessSupplyChunk 행 잠금을 획득한다', async () => {
    const executedOps: string[] = [];
    const fakeTx = {
      $queryRaw: async (query: any) => {
        const sql = String(query.strings ? query.strings.join('?') : query);
        executedOps.push(`tx.$queryRaw:${sql.replace(/\s+/g, ' ').trim()}`);
        return [];
      },
      endlessSupplyJob: {
        findUnique: async () => ({
          id: 'job-p1',
          status: 'running',
          leaseExpiresAt: new Date('2026-10-11T12:10:00.000Z'),
          createdAt: new Date('2026-10-11T12:00:00.000Z'),
        }),
        update: async () => {
          executedOps.push('tx.endlessSupplyJob.update');
          return {};
        },
      },
      endlessSupplyChunk: {
        findUnique: async () => ({
          id: 'job-p1:0',
          jobId: 'job-p1',
          chunkIndex: 0,
          status: 'running',
          stageCount: 0,
        }),
        update: async () => {
          executedOps.push('tx.endlessSupplyChunk.update');
          return {};
        },
      },
      endlessStage: {
        findFirst: async () => null,
        upsert: async () => {
          executedOps.push('tx.endlessStage.upsert');
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
    const stages = Array.from({ length: 1 }, (_, i) => dummyStage(`st-${i}`, 10000 + i));
    const token = new Date('2026-10-11T12:10:00.000Z').toISOString();
    const result = await db.insertSupplyBatch('job-p1', 0, stages, '2026-10-11T12:05:00.000Z', token);

    expect(result).toBe(true);
    const rowLockOps = executedOps.filter((op) => op.includes('FOR UPDATE'));
    expect(rowLockOps.length).toBeGreaterThanOrEqual(1);
    expect(rowLockOps.some((op) => op.includes('EndlessSupplyJob') && op.includes('FOR UPDATE'))).toBe(true);
    expect(rowLockOps.some((op) => op.includes('EndlessSupplyChunk') && op.includes('FOR UPDATE'))).toBe(true);
  });
});
