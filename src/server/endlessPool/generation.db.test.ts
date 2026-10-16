import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ACTIVE_NOW, useRouteDatabase } from '../../../tools/dbTest/routeHarness';

vi.mock('../../shared/sudoku/endlessPoolGenerator', () => ({
  generateEndlessPool: () => {
    throw new Error('generator crashed');
  },
  validateEndlessCandidate: () => true,
}));

vi.mock('./store', async (original) => {
  const actual = await original<typeof import('./store')>();
  return {
    ...actual,
    failSupplyChunk: async () => {
      throw new Error('failure record failed');
    },
  };
});

const db = useRouteDatabase();
let executeSupplyChunk: typeof import('./generation').executeSupplyChunk;

beforeAll(async () => {
  ({ executeSupplyChunk } = await import('./generation'));
});

describe('executeSupplyChunk 실패 처리', () => {
  it('실패 기록이 실패해도 원래 오류를 전달한다', async () => {
    await db.query(
      `insert into "EndlessSupplyJob" (id, "policyVersion", "seedStart", "seedEnd", "targetCount", status, "updatedAt")
       values ('job-1', 'v1', 30000, 30010, 10, 'pending', $1)`,
      [ACTIVE_NOW],
    );
    await db.query(`insert into "EndlessSupplyChunk" (id, "jobId", "chunkIndex", status) values ('job-1:0', 'job-1', 0, 'pending')`);

    await expect(executeSupplyChunk({ jobId: 'job-1', chunkIndex: 0 })).rejects.toThrow('generator crashed');
  });
});
