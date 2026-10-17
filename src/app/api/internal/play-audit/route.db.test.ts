import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ACTIVE_NOW,
  STAGE_SOLUTION,
  callRoute,
  internalAuth,
  qstashSigned,
  secondsBefore,
  seedStage,
  sentryLogs,
  useRouteDatabase,
} from '../../../../../tools/dbTest/routeHarness';

vi.mock('@sentry/nextjs', async () => (await import('../../../../../tools/dbTest/routeHarness')).mockSentry());
vi.mock('next/server', async (original) =>
  (await import('../../../../../tools/dbTest/routeHarness')).mockNextServer(await original()),
);

const db = useRouteDatabase();
let POST: (req: Request) => Promise<Response>;
let GET: (req: Request) => Promise<Response>;

beforeAll(async () => {
  ({ POST, GET } = await import('./route'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

const PATH = '/api/internal/play-audit';
const STAGE = 'e-10000-0';
const SOLUTION_EVENTS = STAGE_SOLUTION.split(';').map((cell, i) => {
  const [r, c] = cell.split(',').map(Number);
  return [1000 * (i + 1), 'correct', r, c];
});

async function seedLog(attemptId: string, events: unknown[] | null, claimedSeedLeft = 3) {
  await db.query(
    `insert into "EndlessPlayLog" ("attemptId", "userId", "stageId", outcome, accepted, "claimedSeedLeft", "serverElapsedMs",
       "logVersion", events, "logError", "createdAt")
     values ($1, 'user-a', $2, 'clear', true, $3, 60000, $4, $5::jsonb, $6, $7)`,
    [
      attemptId,
      STAGE,
      claimedSeedLeft,
      events === null ? null : 1,
      events === null ? null : JSON.stringify(events),
      events === null ? 'invalid' : null,
      secondsBefore(ACTIVE_NOW, 60),
    ],
  );
}

describe('POST /api/internal/play-audit', () => {
  it('인증이 없으면 401을 반환하고 감사하지 않는다', async () => {
    await seedStage(db, { id: STAGE });
    await seedLog('key-1', SOLUTION_EVENTS);

    expect(await callRoute(POST, { path: PATH, rawBody: '' })).toEqual({ status: 401, body: { ok: false, msg: '인증에 실패했어요.' } });
    expect(await db.query(`select "auditedAt" from "EndlessPlayLog"`)).toEqual([{ auditedAt: null }]);
  });

  it('미감사 기록을 감사하고 처리·플래그 건수만 응답하고 기록한다', async () => {
    await seedStage(db, { id: STAGE });
    await seedLog('key-1', SOLUTION_EVENTS);
    await seedLog('key-2', [[500, 'wrong', 0, 1], ...SOLUTION_EVENTS]);
    await seedLog('key-3', null);

    const res = await callRoute(POST, { path: PATH, rawBody: '', headers: internalAuth() });

    expect(res).toEqual({ status: 200, body: { ok: true, audited: 3, flagged: 2 } });
    expect(await db.query(`select count(*)::int as n from "EndlessPlayLog" where "auditedAt" = $1`, [ACTIVE_NOW])).toEqual([{ n: 3 }]);
    expect(sentryLogs).toEqual([{ level: 'info', message: 'Endless play audit', attributes: { audited: 3, flagged: 2 } }]);
  });

  it('QStash 서명 요청과 GET 요청도 감사한다', async () => {
    await seedStage(db, { id: STAGE });
    await seedLog('key-1', SOLUTION_EVENTS);

    expect(await callRoute(POST, { path: PATH, rawBody: '{}', headers: qstashSigned(PATH, '{}') })).toEqual({
      status: 200,
      body: { ok: true, audited: 1, flagged: 0 },
    });
    expect(await callRoute(GET, { path: PATH, headers: internalAuth() })).toEqual({
      status: 200,
      body: { ok: true, audited: 0, flagged: 0 },
    });
  });

  it('감사가 실패하면 500을 반환하고 오류 요약만 남긴다', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    await db.query(`alter table "EndlessPlayLog" rename to "EndlessPlayLogMoved"`);
    try {
      const res = await callRoute(POST, { path: PATH, rawBody: '', headers: internalAuth() });

      expect(res).toEqual({ status: 500, body: { ok: false, msg: '감사를 완료하지 못했어요.' } });
      expect(errors).toHaveBeenCalledWith('Failed to audit play logs', {
        name: expect.any(String),
        code: '42P01',
        constraint: undefined,
        table: undefined,
      });
    } finally {
      await db.query(`alter table "EndlessPlayLogMoved" rename to "EndlessPlayLog"`);
    }
  });
});
