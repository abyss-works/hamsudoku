import { describe, expect, it } from 'vitest';
import { useStoreDatabase } from '../../../tools/dbTest/storeHarness';
import { findStage } from './queries';
import {
  claimSupplyChunk,
  insertStages,
  failSupplyChunk,
  insertSupplyBatch,
  markSupplyJobPublishFailed,
  recordStagePlay,
  reserveSupplyJob,
  type SupplyPolicy,
} from './store';

const store = useStoreDatabase();

const NOW = new Date('2026-10-21T03:00:00.000Z');
const POLICY: SupplyPolicy = { stockThreshold: 20, cooldownMs: 60_000, leaseDurationMs: 120_000, batchCount: 10 };
const MAX_INT = 2_147_483_647;
const MAX_BIGINT = '9223372036854775807';

async function seedStage(id: string, options: { seed?: number; plays?: number; clears?: number; clearTotalMs?: string; regions?: string } = {}) {
  await store.query(
    `insert into "EndlessStage" (id, size, regions, solution, tier, seed, plays, clears, "avgClearMs", "clearTotalMs")
     values ($1, 7, $2, '0,0', 1, $3, $4, $5, 0, $6)`,
    [id, options.regions ?? '0'.repeat(49), options.seed ?? 10000, options.plays ?? 0, options.clears ?? 0, options.clearTotalMs ?? '0'],
  );
}

async function seedJob(input: {
  id?: string;
  status?: string;
  seedStart?: number;
  seedEnd?: number;
  leaseExpiresAt?: Date | null;
  lastSuccessAt?: Date | null;
  chunkStatus?: string;
  stageCount?: number;
}) {
  const id = input.id ?? 'job-1';
  await store.query(
    `insert into "EndlessSupplyJob" (id, "policyVersion", "seedStart", "seedEnd", "targetCount", status, "leaseExpiresAt", "lastSuccessAt", "updatedAt")
     values ($1, 'v1', $2, $3, 10, $4, $5, $6, $7)`,
    [id, input.seedStart ?? 30000, input.seedEnd ?? 30010, input.status ?? 'pending', input.leaseExpiresAt ?? null, input.lastSuccessAt ?? null, NOW],
  );
  await store.query(`insert into "EndlessSupplyChunk" (id, "jobId", "chunkIndex", status, "stageCount") values ($1, $2, 0, $3, $4)`, [
    `${id}:0`,
    id,
    input.chunkStatus ?? 'pending',
    input.stageCount ?? 0,
  ]);
}

function stats() {
  return store.query(`select plays, clears, "clearTotalMs"::text as "clearTotalMs", "avgClearMs" from "EndlessStage" where id = 'e-1-0'`);
}

describe('endlessPool 판 통계', () => {
  it('클리어는 플레이·클리어 수와 누적 시간을 늘리고 평균을 정수로 내림한다', async () => {
    await seedStage('e-1-0', { plays: 4, clears: 2, clearTotalMs: '40000' });
    await recordStagePlay(store.db, 'e-1-0', { cleared: true, elapsedMs: 10001 });
    expect(await stats()).toEqual([{ plays: 5, clears: 3, clearTotalMs: '50001', avgClearMs: 16667 }]);
  });

  it('실패는 플레이 수만 늘린다', async () => {
    await seedStage('e-1-0', { plays: 4, clears: 2, clearTotalMs: '40000' });
    await recordStagePlay(store.db, 'e-1-0', { cleared: false });
    expect(await stats()).toEqual([{ plays: 5, clears: 2, clearTotalMs: '40000', avgClearMs: 0 }]);
  });

  it('통계 값은 컬럼 범위의 최댓값에서 멈춘다', async () => {
    await seedStage('e-1-0', { plays: MAX_INT, clears: MAX_INT, clearTotalMs: MAX_BIGINT });
    await recordStagePlay(store.db, 'e-1-0', { cleared: true, elapsedMs: 5000 });
    expect(await stats()).toEqual([
      { plays: MAX_INT, clears: MAX_INT, clearTotalMs: MAX_BIGINT, avgClearMs: MAX_INT },
    ]);
  });

  it('판 조회는 통계를 포함한 판 행을 반환하고 없으면 null이다', async () => {
    await seedStage('e-1-0', { seed: 12345, plays: 2, clears: 1, clearTotalMs: '7000' });
    expect(await findStage(store.db, 'e-1-0')).toEqual({
      id: 'e-1-0',
      size: 7,
      regions: '0'.repeat(49),
      solution: '0,0',
      tier: 1,
      seed: 12345,
      plays: 2,
      clears: 1,
      avgClearMs: 0,
      clearTotalMs: BigInt(7000),
    });
    expect(await findStage(store.db, 'missing')).toBeNull();
  });
});

describe('endlessPool 공급 작업 예약', () => {
  function reserve(now = NOW) {
    return store.withTransaction((tx) => reserveSupplyJob(tx, now, POLICY));
  }

  async function seedStock(count: number) {
    for (let i = 0; i < count; i += 1) await seedStage(`e-${20000 + i}-0`, { seed: 20000 + i });
  }

  it('클리어 수 0인 판이 20개 이상이면 작업을 만들지 않는다', async () => {
    await seedStock(20);
    expect(await reserve()).toEqual({ shouldEnqueue: false, action: 'sufficient_stock' });
    expect(await store.query(`select 1 from "EndlessSupplyJob"`)).toHaveLength(0);
  });

  it('재고가 19개면 다음 시드 구간의 작업과 청크를 만들고 임대 만료 시각을 기록한다', async () => {
    await seedStock(19);
    const decision = await reserve();
    expect(decision).toEqual({
      shouldEnqueue: true,
      action: 'enqueued',
      jobId: expect.stringMatching(/^job-/),
      seedStart: 20018,
      seedEnd: 20028,
    });
    expect(
      await store.query(
        `select id, "policyVersion", "seedStart", "seedEnd", "targetCount", status, "leaseExpiresAt", "updatedAt" from "EndlessSupplyJob"`,
      ),
    ).toEqual([
      {
        id: decision.jobId,
        policyVersion: 'v1',
        seedStart: 20018,
        seedEnd: 20028,
        targetCount: 10,
        status: 'pending',
        leaseExpiresAt: new Date(NOW.getTime() + 120_000),
        updatedAt: NOW,
      },
    ]);
    expect(await store.query(`select id, "jobId", "chunkIndex", status from "EndlessSupplyChunk"`)).toEqual([
      { id: `${decision.jobId}:0`, jobId: decision.jobId, chunkIndex: 0, status: 'pending' },
    ]);
  });

  it('판이 없으면 예약된 작업의 시드 끝과 기본 시드 중 큰 값부터 예약한다', async () => {
    expect(await reserve()).toMatchObject({ seedStart: 10000, seedEnd: 10010 });
    await store.query(`update "EndlessSupplyJob" set status = 'completed', "leaseExpiresAt" = null`);
    expect(await reserve()).toMatchObject({ seedStart: 10010, seedEnd: 10020 });
  });

  it('유효한 임대의 진행 작업이 있으면 그 작업에 합친다', async () => {
    await seedJob({ status: 'running', leaseExpiresAt: new Date(NOW.getTime() + 1000) });
    expect(await reserve()).toEqual({ shouldEnqueue: false, action: 'merged', jobId: 'job-1' });
  });

  it('임대가 지난 진행 작업은 실패로 바꾸고 새 작업을 만든다', async () => {
    await seedJob({ status: 'running', leaseExpiresAt: NOW });
    expect(await reserve()).toMatchObject({ action: 'enqueued', seedStart: 30010 });
    expect(await store.query(`select status, "updatedAt" from "EndlessSupplyJob" where id = 'job-1'`)).toEqual([
      { status: 'failed', updatedAt: NOW },
    ]);
  });

  it('마지막 적재 성공 후 59초는 쿨다운이고 60초부터 새 작업을 만든다', async () => {
    await seedJob({ status: 'completed', lastSuccessAt: new Date(NOW.getTime() - 59_000), leaseExpiresAt: null });
    expect(await reserve()).toEqual({ shouldEnqueue: false, action: 'cooldown' });
    expect(await reserve(new Date(NOW.getTime() + 1000))).toMatchObject({ action: 'enqueued' });
  });

  it('동시 예약은 작업 하나만 만든다', async () => {
    const results = await Promise.all([reserve(), reserve(), reserve()]);
    expect(results.filter((r) => r.action === 'enqueued')).toHaveLength(1);
    expect(await store.query(`select count(*)::int as n from "EndlessSupplyJob"`)).toEqual([{ n: 1 }]);
  });

  it('발행 실패로 기록하면 작업과 청크가 publish_failed가 되고 임대를 비운다', async () => {
    await seedJob({ status: 'pending', leaseExpiresAt: new Date(NOW.getTime() + 60_000) });
    await markSupplyJobPublishFailed(store.db, 'job-1', NOW);
    expect(await store.query(`select status, "leaseExpiresAt", "updatedAt" from "EndlessSupplyJob"`)).toEqual([
      { status: 'publish_failed', leaseExpiresAt: null, updatedAt: NOW },
    ]);
    expect(await store.query(`select status from "EndlessSupplyChunk"`)).toEqual([{ status: 'publish_failed' }]);
  });
});

describe('endlessPool 공급 청크 처리', () => {
  const LEASE_MS = 120_000;
  const rows = (seed: number, regionsOf = (i: number) => String(seed * 100 + i).padStart(49, '0')) =>
    Array.from({ length: 3 }, (_, i) => ({
      id: `e-${seed}-${i}`,
      size: 7,
      regions: regionsOf(i),
      solution: '0,0',
      tier: 2,
      seed,
    }));

  function claim(now = NOW) {
    return store.withTransaction((tx) => claimSupplyChunk(tx, { jobId: 'job-1', chunkIndex: 0, now, leaseDurationMs: LEASE_MS }));
  }

  async function claimOrThrow() {
    const result = await claim();
    if (!result.claimed) throw new Error('청크를 점유하지 못했다');
    return result;
  }

  it('대기 중인 청크를 점유하면 작업과 청크를 실행 중으로 바꾸고 임대 시각을 점유 토큰으로 반환한다', async () => {
    await seedJob({});
    const result = await claim();
    const lease = new Date(NOW.getTime() + LEASE_MS);
    expect(result).toEqual({
      claimed: true,
      alreadyCompleted: false,
      claimToken: lease.toISOString(),
      stageCount: 0,
      seedStart: 30000,
      targetCount: 10,
    });
    expect(await store.query(`select status, "leaseExpiresAt", "updatedAt" from "EndlessSupplyJob"`)).toEqual([
      { status: 'running', leaseExpiresAt: lease, updatedAt: NOW },
    ]);
    expect(await store.query(`select status from "EndlessSupplyChunk"`)).toEqual([{ status: 'running' }]);
  });

  it('유효한 임대로 실행 중이면 점유하지 않는다', async () => {
    await seedJob({ status: 'running', chunkStatus: 'running', leaseExpiresAt: new Date(NOW.getTime() + 1) });
    expect(await claim()).toEqual({ claimed: false, alreadyCompleted: false, reason: 'CLAIM_BUSY' });
  });

  it('임대가 지난 실행 중 청크는 다시 점유한다', async () => {
    await seedJob({ status: 'running', chunkStatus: 'running', leaseExpiresAt: NOW });
    expect(await claim()).toMatchObject({ claimed: true });
  });

  it('완료된 청크는 완료 결과를 반환하고 없는 작업은 사유를 반환한다', async () => {
    await seedJob({ status: 'completed', chunkStatus: 'completed', stageCount: 10, leaseExpiresAt: null });
    expect(await claim()).toEqual({ claimed: false, alreadyCompleted: true, stageCount: 10 });
    expect(
      await store.withTransaction((tx) => claimSupplyChunk(tx, { jobId: 'missing', chunkIndex: 0, now: NOW, leaseDurationMs: LEASE_MS })),
    ).toEqual({ claimed: false, alreadyCompleted: false, reason: 'JOB_OR_CHUNK_NOT_FOUND' });
  });

  it('동시 점유는 한 요청만 성공한다', async () => {
    await seedJob({});
    const results = await Promise.all([claim(), claim(), claim()]);
    expect(results.filter((r) => r.claimed)).toHaveLength(1);
    expect(results.filter((r) => !r.claimed).map((r) => ('reason' in r ? r.reason : null))).toEqual(['CLAIM_BUSY', 'CLAIM_BUSY']);
  });

  it('점유 토큰이 맞으면 판을 적재하고 청크와 작업을 완료한다', async () => {
    await seedJob({});
    const claimed = await claimOrThrow();
    const completedAt = new Date(NOW.getTime() + 5000);

    const ok = await store.withTransaction((tx) =>
      insertSupplyBatch(tx, { jobId: 'job-1', chunkIndex: 0, rows: rows(30000), completedAt, claimToken: claimed.claimToken }),
    );

    expect(ok).toBe(true);
    expect(await store.query(`select id, seed, plays, clears from "EndlessStage" order by id`)).toEqual(
      [0, 1, 2].map((i) => ({ id: `e-30000-${i}`, seed: 30000, plays: 0, clears: 0 })),
    );
    expect(await store.query(`select status, "stageCount", "completedAt" from "EndlessSupplyChunk"`)).toEqual([
      { status: 'completed', stageCount: 3, completedAt },
    ]);
    expect(await store.query(`select status, "lastSuccessAt", "leaseExpiresAt", "updatedAt" from "EndlessSupplyJob"`)).toEqual([
      { status: 'completed', lastSuccessAt: completedAt, leaseExpiresAt: null, updatedAt: completedAt },
    ]);
  });

  it('다른 실행자의 점유 토큰이나 임대 만료 뒤의 적재는 거부한다', async () => {
    await seedJob({});
    const claimed = await claimOrThrow();
    const stale = new Date(NOW.getTime() - 1000).toISOString();
    const insert = (claimToken: string | undefined, completedAt: Date) =>
      store.withTransaction((tx) => insertSupplyBatch(tx, { jobId: 'job-1', chunkIndex: 0, rows: rows(30000), completedAt, claimToken }));

    expect(await insert(stale, NOW)).toBe(false);
    expect(await insert(claimed.claimToken, new Date(NOW.getTime() + LEASE_MS + 1))).toBe(false);
    expect(await store.query(`select 1 from "EndlessStage"`)).toHaveLength(0);
    expect(await store.query(`select status from "EndlessSupplyChunk"`)).toEqual([{ status: 'running' }]);
  });

  it('기존 판과 영역·해답이 같거나 이전 작업이 만든 같은 id가 있으면 적재하지 않는다', async () => {
    await seedJob({});
    const claimed = await claimOrThrow();
    await seedStage('e-1-0', { regions: rows(30000)[1].regions });
    const insert = () =>
      store.withTransaction((tx) =>
        insertSupplyBatch(tx, { jobId: 'job-1', chunkIndex: 0, rows: rows(30000), completedAt: NOW, claimToken: claimed.claimToken }),
      );
    expect(await insert()).toBe(false);

    await store.query(`delete from "EndlessStage"`);
    await store.query(`insert into "EndlessStage" (id, size, regions, solution, tier, seed, "createdAt") values ('e-30000-2', 7, 'x', 'y', 1, 1, '2000-01-01')`);
    expect(await insert()).toBe(false);
  });

  it('완료된 작업이나 다른 실행자의 실패 기록은 상태를 바꾸지 않는다', async () => {
    await seedJob({ status: 'completed', chunkStatus: 'completed', leaseExpiresAt: null });
    await store.withTransaction((tx) => failSupplyChunk(tx, { jobId: 'job-1', chunkIndex: 0, now: NOW }));
    expect(await store.query(`select status from "EndlessSupplyChunk"`)).toEqual([{ status: 'completed' }]);

    await store.query(`delete from "EndlessSupplyJob"`);
    await seedJob({});
    const claimed = await claimOrThrow();
    await store.withTransaction((tx) =>
      failSupplyChunk(tx, { jobId: 'job-1', chunkIndex: 0, now: NOW, claimToken: new Date(0).toISOString() }),
    );
    expect(await store.query(`select status from "EndlessSupplyChunk"`)).toEqual([{ status: 'running' }]);

    await store.withTransaction((tx) => failSupplyChunk(tx, { jobId: 'job-1', chunkIndex: 0, now: NOW, claimToken: claimed.claimToken }));
    expect(await store.query(`select status from "EndlessSupplyChunk"`)).toEqual([{ status: 'failed' }]);
    expect(await store.query(`select status, "leaseExpiresAt" from "EndlessSupplyJob"`)).toEqual([{ status: 'failed', leaseExpiresAt: null }]);
  });
});

describe('endlessPool 판 일괄 적재', () => {
  it('없는 판만 적재하고 적재한 수를 반환한다', async () => {
    await seedStage('e-7-0');
    const rows = ['e-7-0', 'e-7-1', 'e-7-2'].map((id) => ({ id, size: 7, regions: id.padStart(49, '0'), solution: '0,0', tier: 1, seed: 7 }));
    expect(await insertStages(store.db, rows)).toBe(2);
    expect(await store.query(`select count(*)::int as n from "EndlessStage"`)).toEqual([{ n: 3 }]);
  });
});
