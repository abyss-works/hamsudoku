import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ACTIVE_NOW,
  callRoute,
  internalAuth,
  qstashSigned,
  secondsBefore,
  seedStage,
  useRouteDatabase,
} from '../../../../../tools/dbTest/routeHarness';

vi.mock('next/server', async (original) =>
  (await import('../../../../../tools/dbTest/routeHarness')).mockNextServer(await original()),
);
// 퍼즐 생성은 CPU 비용이 커서 결정적인 후보로 대체한다. 판 번호마다 영역 배치가 다르다.
vi.mock('../../../../shared/sudoku/endlessPoolGenerator', () => ({
  generateEndlessPool: (seed: number, target: number) =>
    Array.from({ length: target }, (_, index) => ({
      islands: [...Array.from({ length: 6 }, () => [0, 1, 2, 3, 4, 5, 6]), String(seed * 100 + index).padStart(7, '0').split('').map(Number)],
      solution: [[0, 0], [1, 2], [2, 4], [3, 6], [4, 1], [5, 3], [6, 5]],
      tier: 2,
    })),
  validateEndlessCandidate: () => true,
}));

const db = useRouteDatabase();
let POST: (req: Request) => Promise<Response>;

beforeAll(async () => {
  ({ POST } = await import('./route'));
});

const PATH = '/api/internal/endless-generate';

function generate(body: unknown) {
  const rawBody = JSON.stringify(body);
  return callRoute(POST, { path: PATH, rawBody, headers: qstashSigned(PATH, rawBody) });
}

function regionsOf(seed: number, index: number) {
  return '0123456'.repeat(6) + String(seed * 100 + index).padStart(7, '0');
}

async function seedJob(input: { status?: string; chunkStatus?: string; leaseExpiresAt?: Date | null; stageCount?: number } = {}) {
  await db.query(
    `insert into "EndlessSupplyJob" (id, "policyVersion", "seedStart", "seedEnd", "targetCount", status, "leaseExpiresAt", "updatedAt")
     values ('job-1', 'v1', 30000, 30010, 10, $1, $2, $3)`,
    [input.status ?? 'pending', input.leaseExpiresAt === undefined ? new Date(ACTIVE_NOW.getTime() + 60_000) : input.leaseExpiresAt, ACTIVE_NOW],
  );
  await db.query(
    `insert into "EndlessSupplyChunk" (id, "jobId", "chunkIndex", status, "stageCount") values ('job-1:0', 'job-1', 0, $1, $2)`,
    [input.chunkStatus ?? 'pending', input.stageCount ?? 0],
  );
}

describe('POST /api/internal/endless-generate', () => {
  it('QStash 서명이 없으면 401을 반환한다', async () => {
    await seedJob();
    const res = await callRoute(POST, { path: PATH, body: { jobId: 'job-1', chunkIndex: 0 }, headers: internalAuth() });
    expect(res).toEqual({ status: 401, body: { ok: false, error: 'Unauthorized signature' } });
  });

  it('JSON이 아니면 400을 반환한다', async () => {
    const res = await callRoute(POST, { path: PATH, rawBody: 'x', headers: qstashSigned(PATH, 'x') });
    expect(res).toEqual({ status: 400, body: { ok: false, error: 'Invalid JSON body' } });
  });

  it('청크 번호가 0이 아니면 400을 반환한다', async () => {
    expect(await generate({ jobId: 'job-1', chunkIndex: 1 })).toEqual({
      status: 400,
      body: { ok: false, error: 'Invalid payload: jobId (string) and chunkIndex (0) are required' },
    });
  });

  it('작업을 점유하고 판 10개를 적재한 뒤 작업과 청크를 완료한다', async () => {
    await seedJob();

    const res = await generate({ jobId: 'job-1', chunkIndex: 0 });

    expect(res).toEqual({ status: 200, body: { ok: true, stageCount: 10, jobId: 'job-1', chunkIndex: 0 } });
    const stages = await db.query(
      `select id, size, regions, solution, tier, seed, plays, clears, "avgClearMs", "clearTotalMs"::int as "clearTotalMs"
       from "EndlessStage" order by id`,
    );
    expect(stages).toEqual(
      Array.from({ length: 10 }, (_, i) => ({
        id: `e-30000-${i}`,
        size: 7,
        regions: regionsOf(30000, i),
        solution: '0,0;1,2;2,4;3,6;4,1;5,3;6,5',
        tier: 2,
        seed: 30000,
        plays: 0,
        clears: 0,
        avgClearMs: 0,
        clearTotalMs: 0,
      })),
    );
    expect(await db.query(`select status, "stageCount", "completedAt" from "EndlessSupplyChunk"`)).toEqual([
      { status: 'completed', stageCount: 10, completedAt: ACTIVE_NOW },
    ]);
    expect(await db.query(`select status, "lastSuccessAt", "leaseExpiresAt" from "EndlessSupplyJob"`)).toEqual([
      { status: 'completed', lastSuccessAt: ACTIVE_NOW, leaseExpiresAt: null },
    ]);
  });

  it('완료된 청크의 재전달은 다시 적재하지 않고 완료 결과를 반환한다', async () => {
    await seedJob();
    await generate({ jobId: 'job-1', chunkIndex: 0 });

    const res = await generate({ jobId: 'job-1', chunkIndex: 0 });

    expect(res).toEqual({
      status: 200,
      body: { ok: true, alreadyCompleted: true, stageCount: 10, jobId: 'job-1', chunkIndex: 0 },
    });
    expect(await db.query(`select 1 from "EndlessStage"`)).toHaveLength(10);
  });

  it('다른 실행이 유효한 임대로 점유 중이면 429를 반환한다', async () => {
    await seedJob({ status: 'running', chunkStatus: 'running' });
    expect(await generate({ jobId: 'job-1', chunkIndex: 0 })).toEqual({
      status: 429,
      body: { ok: false, reason: 'CLAIM_BUSY', jobId: 'job-1', chunkIndex: 0 },
    });
    expect(await db.query(`select 1 from "EndlessStage"`)).toHaveLength(0);
  });

  it('임대가 만료된 실행 중 청크는 다시 점유해 완료한다', async () => {
    await seedJob({ status: 'running', chunkStatus: 'running', leaseExpiresAt: secondsBefore(ACTIVE_NOW, 1) });
    expect((await generate({ jobId: 'job-1', chunkIndex: 0 })).body).toMatchObject({ ok: true, stageCount: 10 });
  });

  it('없는 작업은 500을 반환한다', async () => {
    expect(await generate({ jobId: 'job-missing', chunkIndex: 0 })).toEqual({
      status: 500,
      body: { ok: false, reason: 'JOB_OR_CHUNK_NOT_FOUND', jobId: 'job-missing', chunkIndex: 0 },
    });
  });

  it('이미 있는 판과 내용이 같으면 적재하지 않고 작업을 실패로 기록한다', async () => {
    await seedJob();
    await seedStage(db, { id: 'e-1-0', regions: regionsOf(30000, 3), solution: '0,0;1,2;2,4;3,6;4,1;5,3;6,5' });

    const res = await generate({ jobId: 'job-1', chunkIndex: 0 });

    expect(res).toEqual({ status: 500, body: { ok: false, reason: 'CONTENT_DUPLICATE_OR_TARGET_UNMET' } });
    expect(await db.query(`select id from "EndlessStage"`)).toEqual([{ id: 'e-1-0' }]);
    expect(await db.query(`select status from "EndlessSupplyChunk"`)).toEqual([{ status: 'failed' }]);
    expect(await db.query(`select status, "leaseExpiresAt" from "EndlessSupplyJob"`)).toEqual([
      { status: 'failed', leaseExpiresAt: null },
    ]);
  });
});
