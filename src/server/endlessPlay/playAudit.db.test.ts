import { beforeAll, describe, expect, it } from 'vitest';
import { ACTIVE_NOW, STAGE_SOLUTION, secondsBefore, seedStage, useRouteDatabase, type RouteDatabase } from '../../../tools/dbTest/routeHarness';

const db = useRouteDatabase();
let audit: typeof import('./playAudit');

beforeAll(async () => {
  audit = await import('./playAudit');
});

const STAGE = 'e-10000-0';
const SOLUTION_EVENTS = STAGE_SOLUTION.split(';').map((cell, i) => {
  const [r, c] = cell.split(',').map(Number);
  return [1000 * (i + 1), 'correct', r, c];
});

interface SeedLog {
  attemptId: string;
  outcome?: 'clear' | 'fail';
  claimedSeedLeft?: number | null;
  serverElapsedMs?: number;
  events?: unknown[] | null;
  createdAt?: Date;
  auditedAt?: Date | null;
  stageId?: string;
}

async function seedLog(database: RouteDatabase, input: SeedLog): Promise<void> {
  const outcome = input.outcome ?? 'clear';
  const events = input.events === undefined ? SOLUTION_EVENTS : input.events;
  await database.query(
    `insert into "EndlessPlayLog" ("attemptId", "userId", "stageId", outcome, accepted, "claimedSeedLeft", "serverElapsedMs",
       "logVersion", events, "logError", "createdAt", "auditedAt")
     values ($1, 'user-a', $2, $3, true, $4, $5, $6, $7::jsonb, $8, $9, $10)`,
    [
      input.attemptId,
      input.stageId ?? STAGE,
      outcome,
      input.claimedSeedLeft === undefined ? (outcome === 'clear' ? 3 : null) : input.claimedSeedLeft,
      input.serverElapsedMs ?? 60_000,
      events === null ? null : 1,
      events === null ? null : JSON.stringify(events),
      events === null ? 'missing' : null,
      input.createdAt ?? secondsBefore(ACTIVE_NOW, 60),
      input.auditedAt ?? null,
    ],
  );
}

describe('auditPlayLogs', () => {
  it('미감사 기록을 판 정답과 대조해 감사 결과와 감사 시각을 저장하고 건수를 반환한다', async () => {
    await seedStage(db, { id: STAGE });
    await seedLog(db, { attemptId: 'clean' });
    await seedLog(db, { attemptId: 'seed', claimedSeedLeft: 3, events: [[500, 'wrong', 0, 1], ...SOLUTION_EVENTS] });
    await seedLog(db, { attemptId: 'none', events: null });

    const result = await audit.auditPlayLogs(ACTIVE_NOW);

    expect(result).toEqual({ audited: 3, flagged: 2, flagCounts: { no_log: 1, seedMismatch: 1 } });
    const rows = await db.query<{ attemptId: string; auditedAt: Date; audit: { flags: string[] } }>(
      `select "attemptId", "auditedAt", audit from "EndlessPlayLog" order by "attemptId"`,
    );
    expect(rows.map((row) => [row.attemptId, row.auditedAt, row.audit.flags])).toEqual([
      ['clean', ACTIVE_NOW, []],
      ['none', ACTIVE_NOW, ['no_log']],
      ['seed', ACTIVE_NOW, ['seedMismatch']],
    ]);
    expect(rows[0].audit).toEqual({
      version: 1,
      wrongCount: 0,
      derivedSeedLeft: 3,
      seedMismatch: false,
      correctOffSolution: 0,
      missingSolutionCells: 0,
      nonMonotonic: false,
      clientDurationMs: 7000,
      durationExceedsServer: false,
      minCorrectGapMs: 1000,
      flags: [],
    });
  });

  it('이미 감사한 기록은 다시 감사하지 않는다', async () => {
    await seedStage(db, { id: STAGE });
    const earlier = secondsBefore(ACTIVE_NOW, 3600);
    await seedLog(db, { attemptId: 'done', auditedAt: earlier });
    await db.query(`update "EndlessPlayLog" set audit = '{"version":1,"flags":["kept"]}'::jsonb`);

    expect(await audit.auditPlayLogs(ACTIVE_NOW)).toEqual({ audited: 0, flagged: 0, flagCounts: {} });
    expect(await db.query(`select "auditedAt", audit from "EndlessPlayLog"`)).toEqual([
      { auditedAt: earlier, audit: { version: 1, flags: ['kept'] } },
    ]);
  });

  it('한 번에 지정한 건수까지 오래된 기록부터 감사한다', async () => {
    await seedStage(db, { id: STAGE });
    await seedLog(db, { attemptId: 'newest', createdAt: secondsBefore(ACTIVE_NOW, 10) });
    await seedLog(db, { attemptId: 'oldest', createdAt: secondsBefore(ACTIVE_NOW, 30) });
    await seedLog(db, { attemptId: 'middle', createdAt: secondsBefore(ACTIVE_NOW, 20) });

    expect(await audit.auditPlayLogs(ACTIVE_NOW, 2)).toEqual({ audited: 2, flagged: 0, flagCounts: {} });
    expect(await db.query(`select "attemptId" from "EndlessPlayLog" where "auditedAt" is null`)).toEqual([
      { attemptId: 'newest' },
    ]);
  });

  it('1회 처리 상한은 500건이다', () => {
    expect(audit.AUDIT_BATCH_LIMIT).toBe(500);
  });

  it('실패 보고는 클리어 전용 지표를 판정하지 않는다', async () => {
    await seedStage(db, { id: STAGE });
    await seedLog(db, {
      attemptId: 'fail',
      outcome: 'fail',
      events: [[100, 'wrong', 0, 1], [200, 'wrong', 0, 2], [300, 'wrong', 0, 3]],
    });

    expect(await audit.auditPlayLogs(ACTIVE_NOW)).toEqual({ audited: 1, flagged: 0, flagCounts: {} });
    expect(await db.query(`select audit from "EndlessPlayLog"`)).toEqual([
      {
        audit: expect.objectContaining({ wrongCount: 3, derivedSeedLeft: 0, seedMismatch: null, missingSolutionCells: null, flags: [] }),
      },
    ]);
  });
});
