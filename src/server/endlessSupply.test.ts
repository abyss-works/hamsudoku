import { describe, expect, it } from 'vitest';
import { createMemoryDb } from './db';
import {
  evaluateSupplyDecision,
  requestSupply,
  type EndlessSupplyJobRow,
} from './endlessSupply';

describe('evaluateSupplyDecision', () => {
  const baseTime = '2026-10-11T12:00:00.000Z';
  const timeOffset = (ms: number) => new Date(Date.parse(baseTime) + ms).toISOString();

  it('재고 20개 이상이면 보충 작업을 만들지 않는다 (20개 경계)', () => {
    const res20 = evaluateSupplyDecision({
      stockCount: 20,
      activeJob: null,
      lastSuccessAt: null,
      nowIso: baseTime,
    });
    expect(res20).toEqual({ shouldEnqueue: false, action: 'sufficient_stock' });

    const res25 = evaluateSupplyDecision({
      stockCount: 25,
      activeJob: null,
      lastSuccessAt: null,
      nowIso: baseTime,
    });
    expect(res25).toEqual({ shouldEnqueue: false, action: 'sufficient_stock' });
  });

  it('재고 19개 이하면 신규 보충 작업을 허용한다 (19개 경계)', () => {
    const res19 = evaluateSupplyDecision({
      stockCount: 19,
      activeJob: null,
      lastSuccessAt: null,
      nowIso: baseTime,
    });
    expect(res19).toEqual({ shouldEnqueue: true, action: 'enqueued' });

    const res0 = evaluateSupplyDecision({
      stockCount: 0,
      activeJob: null,
      lastSuccessAt: null,
      nowIso: baseTime,
    });
    expect(res0).toEqual({ shouldEnqueue: true, action: 'enqueued' });
  });

  it('최근 DB 적재 성공 후 59초는 쿨다운이며, 60초는 허용한다 (쿨다운 경계)', () => {
    const lastSuccess = baseTime;

    // 59초 경과 -> 쿨다운
    const res59 = evaluateSupplyDecision({
      stockCount: 10,
      activeJob: null,
      lastSuccessAt: lastSuccess,
      nowIso: timeOffset(59_000),
    });
    expect(res59).toEqual({ shouldEnqueue: false, action: 'cooldown' });

    // 60초 경과 -> 큐잉 허용
    const res60 = evaluateSupplyDecision({
      stockCount: 10,
      activeJob: null,
      lastSuccessAt: lastSuccess,
      nowIso: timeOffset(60_000),
    });
    expect(res60).toEqual({ shouldEnqueue: true, action: 'enqueued' });
  });

  it('활성 작업이 존재하면 60초 경과 여부와 무관하게 추가 작업을 합친다', () => {
    const activeJob: EndlessSupplyJobRow = {
      id: 'job-active-1',
      policyVersion: 'v1',
      seedStart: 1000,
      seedEnd: 1010,
      targetCount: 10,
      status: 'pending',
      leaseExpiresAt: timeOffset(120_000),
      lastSuccessAt: null,
      createdAt: baseTime,
      updatedAt: baseTime,
    };

    // 쿨다운 내(30초)여도 활성 작업 합침
    const resWithin = evaluateSupplyDecision({
      stockCount: 10,
      activeJob,
      lastSuccessAt: baseTime,
      nowIso: timeOffset(30_000),
    });
    expect(resWithin).toEqual({ shouldEnqueue: false, action: 'merged', jobId: 'job-active-1' });

    // 쿨다운 후(70초)여도 활성 작업 합침
    const resAfter = evaluateSupplyDecision({
      stockCount: 10,
      activeJob,
      lastSuccessAt: baseTime,
      nowIso: timeOffset(70_000),
    });
    expect(resAfter).toEqual({ shouldEnqueue: false, action: 'merged', jobId: 'job-active-1' });
  });
});

describe('requestSupply with DB integration', () => {
  const stage = (id: string) => ({ id, size: 7, regions: '0'.repeat(49), solution: '0,0', tier: 2, seed: 1 });

  it('재고 20개 이상일 때는 큐 등록 없이 sufficient_stock을 반환한다', async () => {
    const db = createMemoryDb();
    for (let i = 0; i < 20; i++) {
      await db.insertStage(stage(`st-${i}`));
    }
    const enqueued: string[] = [];
    const enqueuer = {
      enqueueChunk: async (jobId: string) => {
        enqueued.push(jobId);
      },
    };

    const res = await requestSupply(db, '2026-10-11T12:00:00.000Z', enqueuer);
    expect(res.action).toBe('sufficient_stock');
    expect(enqueued).toHaveLength(0);
  });

  it('재고 19개이고 이전 적재가 없으면 작업을 생성하고 QStash 큐에 등록한다', async () => {
    const db = createMemoryDb();
    for (let i = 0; i < 19; i++) {
      await db.insertStage(stage(`st-${i}`));
    }
    const enqueued: { jobId: string; chunkIndex: number }[] = [];
    const enqueuer = {
      enqueueChunk: async (jobId: string, chunkIndex: number) => {
        enqueued.push({ jobId, chunkIndex });
      },
    };

    const res = await requestSupply(db, '2026-10-11T12:00:00.000Z', enqueuer);
    expect(res.action).toBe('enqueued');
    expect(res.jobId).toBeTruthy();
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0].chunkIndex).toBe(0);
  });

  it('활성 작업이 존재하면 큐잉하지 않고 기존 작업에 합친다', async () => {
    const db = createMemoryDb();
    for (let i = 0; i < 10; i++) {
      await db.insertStage(stage(`st-${i}`));
    }
    const enqueued: { jobId: string; chunkIndex: number }[] = [];
    const enqueuer = {
      enqueueChunk: async (jobId: string, chunkIndex: number) => {
        enqueued.push({ jobId, chunkIndex });
      },
    };

    // 첫 요청: 새 작업 큐잉
    const res1 = await requestSupply(db, '2026-10-11T12:00:00.000Z', enqueuer);
    expect(res1.action).toBe('enqueued');
    const firstJobId = res1.jobId;

    // 동시 두 번째 요청: 활성 작업이 있으므로 합침
    const res2 = await requestSupply(db, '2026-10-11T12:00:05.000Z', enqueuer);
    expect(res2.action).toBe('merged');
    expect(res2.jobId).toBe(firstJobId);
    expect(enqueued).toHaveLength(1); // 추가 큐잉 없음
  });

  it('임대가 만료된 작업은 활성 작업으로 취급하지 않는다', async () => {
    const db = createMemoryDb();
    const enqueued: { jobId: string; chunkIndex: number }[] = [];
    const enqueuer = {
      enqueueChunk: async (jobId: string, chunkIndex: number) => {
        enqueued.push({ jobId, chunkIndex });
      },
    };

    // 첫 요청 시점: 12:00:00 (임대 만료 12:02:00)
    const res1 = await requestSupply(db, '2026-10-11T12:00:00.000Z', enqueuer);
    expect(res1.action).toBe('enqueued');

    // 12:03:00 (임대 120초 만료 이후): 새 작업 생성 가능
    const res2 = await requestSupply(db, '2026-10-11T12:03:00.000Z', enqueuer);
    expect(res2.action).toBe('enqueued');
    expect(res2.jobId).not.toBe(res1.jobId);
    expect(enqueued).toHaveLength(2);
  });
});
