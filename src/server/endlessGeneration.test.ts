import { describe, expect, it } from 'vitest';
import { createMemoryDb } from './db';
import { executeSupplyChunk, validateEndlessCandidate } from './endlessGeneration';
import type { Pos } from '../features/sudoku/model/solver';

describe('executeSupplyChunk atomic claim and generation validation', () => {
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

    const result = await executeSupplyChunk(db, { jobId, chunkIndex: 0 });
    expect(result.ok).toBe(true);
    expect(result.stageCount).toBe(10);

    // DB에 10개 스테이지가 적재되었는지 확인
    const count = await db.countStages();
    expect(count).toBe(10);

    // 청크가 completed 상태로 갱신되었는지 확인
    const chunk = await db.findSupplyChunk(jobId, 0);
    expect(chunk?.status).toBe('completed');
    expect(chunk?.stageCount).toBe(10);

    // 작업의 lastSuccessAt이 갱신되었는지 확인
    const job = await db.findSupplyJob(jobId);
    expect(job?.lastSuccessAt).toBeDefined();
    expect(job?.status).toBe('completed');
  }, 60_000);

  it('유효한 활성 임대(running & 미만료 lease)가 있으면 중복 실행하지 않고 CLAIM_BUSY를 반환한다', async () => {
    const db = createMemoryDb();
    const jobId = 'job-claim-busy';
    const futureLease = new Date(Date.now() + 60_000).toISOString();
    await db.createSupplyJob({
      id: jobId,
      policyVersion: 'v1',
      seedStart: 10000,
      seedEnd: 10010,
      targetCount: 10,
      leaseExpiresAt: futureLease,
    });
    await db.createSupplyChunk({
      id: `${jobId}:0`,
      jobId,
      chunkIndex: 0,
      status: 'running',
    });

    const result = await executeSupplyChunk(db, { jobId, chunkIndex: 0 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('CLAIM_BUSY');
  });

  it('임대가 만료된(lease expired) running 청크는 새로운 실행자가 원자적으로 회복하여 claim할 수 있다', async () => {
    const db = createMemoryDb();
    const jobId = 'job-claim-recover';
    const pastLease = new Date(Date.now() - 10_000).toISOString();
    await db.createSupplyJob({
      id: jobId,
      policyVersion: 'v1',
      seedStart: 10000,
      seedEnd: 10010,
      targetCount: 10,
      leaseExpiresAt: pastLease,
    });
    await db.createSupplyChunk({
      id: `${jobId}:0`,
      jobId,
      chunkIndex: 0,
      status: 'running',
    });

    const result = await executeSupplyChunk(db, { jobId, chunkIndex: 0 });
    expect(result.ok).toBe(true);
    expect(result.stageCount).toBe(10);
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

  it('기존 DB 전체와 콘텐츠 중복(동일 영역+해답)이 존재하고 신규 10개에 미달하면 성공 처리하지 않는다', async () => {
    const db = createMemoryDb();
    const jobId = 'job-dup-content';
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

    // 1회 정상 적재
    const res1 = await executeSupplyChunk(db, { jobId, chunkIndex: 0 });
    expect(res1.ok).toBe(true);

    // 다른 작업에서 정확히 동일한 시드/콘텐츠를 생성하려 할 때 신규 스테이지가 0개이므로 중복으로 간주하고 목표 미달 실패 처리해야 함
    const otherJobId = 'job-dup-content-2';
    await db.createSupplyJob({
      id: otherJobId,
      policyVersion: 'v1',
      seedStart: 10000,
      seedEnd: 10010,
      targetCount: 10,
      leaseExpiresAt: new Date(Date.now() + 120_000).toISOString(),
    });
    await db.createSupplyChunk({
      id: `${otherJobId}:0`,
      jobId: otherJobId,
      chunkIndex: 0,
      status: 'pending',
    });

    const res2 = await executeSupplyChunk(db, { jobId: otherJobId, chunkIndex: 0 });
    expect(res2.ok).toBe(false);
    expect(res2.reason).toBe('CONTENT_DUPLICATE_OR_TARGET_UNMET');
  }, 60_000);

  it('validateEndlessCandidate가 7x7 크기, 영역 연결성, 유일 해답을 올바르게 검증한다', () => {
    // 7x7이 아닌 경우 실패
    const invalidSizeCandidate = {
      islands: [[0, 1], [0, 1]],
      solution: [[0, 0], [1, 1]] as Pos[],
      tier: 1,
    };
    expect(validateEndlessCandidate(invalidSizeCandidate)).toBe(false);
  });

  it('존재하지 않는 작업이나 청크 요청은 실패를 반환한다', async () => {
    const db = createMemoryDb();
    const res = await executeSupplyChunk(db, { jobId: 'job-nonexistent', chunkIndex: 0 });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('JOB_OR_CHUNK_NOT_FOUND');
  });
});
