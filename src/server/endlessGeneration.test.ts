import { describe, expect, it } from 'vitest';
import { createMemoryDb } from './db';
import { executeSupplyChunk } from './endlessGeneration';

describe('executeSupplyChunk', () => {
  it('청크를 실행하여 10개 퍼즐을 생성·검증하고 원자적으로 DB에 적재한다', async () => {
    const db = createMemoryDb();
    const jobId = 'job-gen-1';
    await db.createSupplyJob({
      id: jobId,
      policyVersion: 'v1',
      seedStart: 10000,
      seedEnd: 10010,
      targetCount: 10,
      leaseExpiresAt: new Date(Date.now() + 120_000).toISOString(),
    });
    await db.createSupplyChunk({
      id: `${jobId}:0`,
      jobId,
      chunkIndex: 0,
      status: 'pending',
    });

    const nowIso = '2026-10-11T13:00:00.000Z';
    const result = await executeSupplyChunk(db, { jobId, chunkIndex: 0 }, nowIso);
    expect(result.ok).toBe(true);
    expect(result.stageCount).toBe(10);

    // DB에 10개 스테이지가 적재되었는지 확인
    const count = await db.countStages();
    expect(count).toBe(10);

    // 청크가 completed 상태로 갱신되었는지 확인
    const chunk = await db.findSupplyChunk(jobId, 0);
    expect(chunk?.status).toBe('completed');
    expect(chunk?.stageCount).toBe(10);
    expect(chunk?.completedAt).toBe(nowIso);

    // 작업의 lastSuccessAt이 갱신되었는지 확인
    const job = await db.findSupplyJob(jobId);
    expect(job?.lastSuccessAt).toBe(nowIso);
  }, 60_000);

  it('같은 청크가 재전달되어도 중복 퍼즐을 생성하지 않고 멱등하게 성공을 반환한다 (재전달 안전성)', async () => {
    const db = createMemoryDb();
    const jobId = 'job-gen-dup';
    await db.createSupplyJob({
      id: jobId,
      policyVersion: 'v1',
      seedStart: 10000,
      seedEnd: 10010,
      targetCount: 10,
      leaseExpiresAt: new Date(Date.now() + 120_000).toISOString(),
    });
    await db.createSupplyChunk({
      id: `${jobId}:0`,
      jobId,
      chunkIndex: 0,
      status: 'pending',
    });

    // 1회차 실행
    const res1 = await executeSupplyChunk(db, { jobId, chunkIndex: 0 });
    expect(res1.ok).toBe(true);
    expect(res1.stageCount).toBe(10);

    const stagesCountBefore = await db.countStages();
    expect(stagesCountBefore).toBe(10);

    // 2회차 재전달 실행
    const res2 = await executeSupplyChunk(db, { jobId, chunkIndex: 0 });
    expect(res2.ok).toBe(true);
    expect(res2.alreadyCompleted).toBe(true);

    // DB에 퍼즐이 중복으로 늘어나지 않아야 한다
    const stagesCountAfter = await db.countStages();
    expect(stagesCountAfter).toBe(10);
  }, 60_000);

  it('존재하지 않는 작업이나 청크 요청은 실패를 반환한다', async () => {
    const db = createMemoryDb();
    const res = await executeSupplyChunk(db, { jobId: 'job-nonexistent', chunkIndex: 0 });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('JOB_OR_CHUNK_NOT_FOUND');
  });
});
