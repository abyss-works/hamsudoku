import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useRouteDatabase, type RouteDatabase } from '../../../tools/dbTest/routeHarness';

const recheck = vi.hoisted(() => ({ inconsistentStageId: null as string | null }));

// 적용 단계의 판별 재집계에서 불일치가 생긴 상황을 재현한다.
vi.mock('./queries', async (original) => {
  const actual = await original<typeof import('./queries')>();
  return {
    ...actual,
    listStageStatsAggregates: async (...args: Parameters<typeof actual.listStageStatsAggregates>) => {
      const rows = await actual.listStageStatsAggregates(...args);
      const [, stageId] = args;
      if (stageId && stageId === recheck.inconsistentStageId) {
        return rows.map((row) => ({ ...row, verifiedClearCount: 0, verifiedClearTotalMs: BigInt(0) }));
      }
      return rows;
    },
  };
});

const db = useRouteDatabase();
let backfillStageStats: typeof import('./statsBackfill').backfillStageStats;

beforeAll(async () => {
  ({ backfillStageStats } = await import('./statsBackfill'));
});

async function seedStage(id: string, stats: { plays: number; clears: number; total: number; avg: number } = { plays: 0, clears: 0, total: 0, avg: 0 }) {
  await db.query(
    `insert into "EndlessStage" (id, size, regions, solution, tier, seed, plays, clears, "avgClearMs", "clearTotalMs")
     values ($1, 7, $2, '0,0', 2, 1, $3, $4, $5, $6)`,
    [id, '0'.repeat(49), stats.plays, stats.clears, stats.avg, stats.total],
  );
}

/** 클리어 1건: 진행 기록(클리어, 시도 1)과 검증 이벤트. */
async function seedClear(database: RouteDatabase, userId: string, stageId: string, elapsedMs: number) {
  await database.query(
    `insert into "EndlessProgress" ("userId", "stageId", cleared, attempts, "lastPlayedAt") values ($1, $2, true, 1, now())`,
    [userId, stageId],
  );
  await database.query(
    `insert into "EndlessEvent" ("userId", "stageId", "seedLeft", "elapsedMs", verified) values ($1, $2, 3, $3, true)`,
    [userId, stageId, elapsedMs],
  );
}

async function seedProgressOnly(userId: string, stageId: string) {
  await db.query(
    `insert into "EndlessProgress" ("userId", "stageId", cleared, attempts, "lastPlayedAt") values ($1, $2, true, 1, now())`,
    [userId, stageId],
  );
}

function stats(id: string) {
  return db.query(`select plays, clears, "clearTotalMs"::int as "clearTotalMs", "avgClearMs" from "EndlessStage" where id = $1`, [id]);
}

describe('backfillStageStats', () => {
  it('정수 평균이 이미 맞으면 dry-run과 적용 모두 변경이 없다', async () => {
    await seedStage('average', { plays: 2, clears: 2, total: 20001, avg: 10000 });
    await seedClear(db, 'u1', 'average', 10000);
    await seedClear(db, 'u2', 'average', 10001);

    expect((await backfillStageStats({ dryRun: true })).updatedStages).toBe(0);
    expect((await backfillStageStats({ dryRun: false })).updatedStages).toBe(0);
  });

  it('dry-run은 DB를 바꾸지 않고 보정 대상 수를 보고한다', async () => {
    await seedStage('e-1');
    await seedClear(db, 'u1', 'e-1', 25000);

    expect(await backfillStageStats({ dryRun: true })).toEqual({
      ok: true,
      dryRun: true,
      totalStages: 1,
      scannedStages: 1,
      updatedStages: 1,
      inconsistentStages: 0,
      errors: [],
    });
    expect(await stats('e-1')).toEqual([{ plays: 0, clears: 0, clearTotalMs: 0, avgClearMs: 0 }]);
  });

  it('적용 모드는 플레이·클리어 수와 누적·평균 시간을 복원하고 재실행에는 변경이 없다', async () => {
    await seedStage('e-1');
    await seedClear(db, 'u1', 'e-1', 20000);
    await seedClear(db, 'u2', 'e-1', 40000);

    expect(await backfillStageStats({ dryRun: false })).toMatchObject({ ok: true, dryRun: false, updatedStages: 1 });
    expect(await stats('e-1')).toEqual([{ plays: 2, clears: 2, clearTotalMs: 60000, avgClearMs: 30000 }]);
    expect((await backfillStageStats({ dryRun: false })).updatedStages).toBe(0);
  });

  it('진행 기록에 클리어가 있는데 검증 이벤트가 없으면 보정하지 않고 오류를 보고한다', async () => {
    await seedStage('e-inconsistent');
    await seedProgressOnly('u1', 'e-inconsistent');

    const report = await backfillStageStats({ dryRun: false });

    expect(report.ok).toBe(false);
    expect(report.inconsistentStages).toBe(1);
    expect(report.errors[0]).toContain('e-inconsistent');
    expect(await stats('e-inconsistent')).toEqual([{ plays: 0, clears: 0, clearTotalMs: 0, avgClearMs: 0 }]);
  });

  it('일부 판만 불일치해도 전체 검사를 먼저 끝내고 정상 판도 쓰지 않는다', async () => {
    await seedStage('e-valid');
    await seedClear(db, 'u1', 'e-valid', 20000);
    await seedStage('e-partial');
    await seedClear(db, 'u1', 'e-partial', 20000);
    await seedProgressOnly('u2', 'e-partial');

    const report = await backfillStageStats({ dryRun: false });

    expect(report.ok).toBe(false);
    expect(report.inconsistentStages).toBe(1);
    expect(await stats('e-valid')).toEqual([{ plays: 0, clears: 0, clearTotalMs: 0, avgClearMs: 0 }]);
  });

  it('적용 중 재집계에서 불일치가 나오면 그 뒤의 판은 쓰지 않는다', async () => {
    for (const id of ['first', 'second']) {
      await seedStage(id);
      await seedClear(db, 'u1', id, 10000);
    }
    recheck.inconsistentStageId = 'first';
    try {
      const report = await backfillStageStats({ dryRun: false });
      expect(report.ok).toBe(false);
      expect(report.errors).toHaveLength(1);
    } finally {
      recheck.inconsistentStageId = null;
    }
    expect(await stats('first')).toEqual([{ plays: 0, clears: 0, clearTotalMs: 0, avgClearMs: 0 }]);
    expect(await stats('second')).toEqual([{ plays: 0, clears: 0, clearTotalMs: 0, avgClearMs: 0 }]);
  });
});
