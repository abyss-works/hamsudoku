import { describe, expect, it } from 'vitest';
import { useStoreDatabase } from '../../../tools/dbTest/storeHarness';
import { findNextSupplyChunk } from './queries';

const store = useStoreDatabase();

const NOW = new Date('2026-10-21T03:00:00.000Z');

async function seedJob(input: {
  id: string;
  status: string;
  chunkStatus?: string;
  leaseExpiresAt?: Date | null;
  createdAt?: Date;
}) {
  await store.query(
    `insert into "EndlessSupplyJob" (id, "policyVersion", "seedStart", "seedEnd", "targetCount", status, "leaseExpiresAt", "createdAt", "updatedAt")
     values ($1, 'v1', 30000, 30010, 10, $2, $3, $4, $4)`,
    [input.id, input.status, input.leaseExpiresAt ?? null, input.createdAt ?? NOW],
  );
  await store.query(
    `insert into "EndlessSupplyChunk" (id, "jobId", "chunkIndex", status) values ($1, $2, 0, $3)`,
    [`${input.id}:0`, input.id, input.chunkStatus ?? input.status],
  );
}

describe('findNextSupplyChunk', () => {
  it('처리할 작업이 없으면 null이다', async () => {
    expect(await findNextSupplyChunk(store.db, NOW)).toBeNull();
  });

  it.each([['pending'], ['publish_failed']])('%s 작업의 청크를 찾는다', async (status) => {
    await seedJob({ id: 'job-1', status, leaseExpiresAt: new Date(NOW.getTime() + 60_000) });
    expect(await findNextSupplyChunk(store.db, NOW)).toEqual({ jobId: 'job-1', chunkIndex: 0 });
  });

  it('임대가 만료된 실행 중 작업은 찾고 유효한 임대의 실행 중 작업은 건너뛴다', async () => {
    await seedJob({ id: 'job-live', status: 'running', leaseExpiresAt: new Date(NOW.getTime() + 1) });
    expect(await findNextSupplyChunk(store.db, NOW)).toBeNull();
    await seedJob({ id: 'job-expired', status: 'running', leaseExpiresAt: NOW, createdAt: new Date(NOW.getTime() + 1000) });
    expect(await findNextSupplyChunk(store.db, NOW)).toEqual({ jobId: 'job-expired', chunkIndex: 0 });
  });

  it('완료되었거나 실패한 작업은 건너뛴다', async () => {
    await seedJob({ id: 'job-done', status: 'completed' });
    await seedJob({ id: 'job-failed', status: 'failed' });
    expect(await findNextSupplyChunk(store.db, NOW)).toBeNull();
  });

  it('가장 먼저 만든 작업부터 찾는다', async () => {
    await seedJob({ id: 'job-new', status: 'pending', createdAt: new Date(NOW.getTime() + 2000) });
    await seedJob({ id: 'job-old', status: 'pending', createdAt: new Date(NOW.getTime() - 2000) });
    expect(await findNextSupplyChunk(store.db, NOW)).toEqual({ jobId: 'job-old', chunkIndex: 0 });
  });
});
