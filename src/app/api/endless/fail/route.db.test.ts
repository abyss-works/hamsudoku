import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ACTIVE_NOW,
  callRoute,
  secondsBefore,
  seedAttempt,
  type SeedAttempt,
  seedStage,
  seedUser,
  sentryLogs,
  signInAs,
  useRouteDatabase,
} from '../../../../../tools/dbTest/routeHarness';

vi.mock('@sentry/nextjs', async () => (await import('../../../../../tools/dbTest/routeHarness')).mockSentry());
vi.mock('next/server', async (original) =>
  (await import('../../../../../tools/dbTest/routeHarness')).mockNextServer(await original()),
);
vi.mock('../../../../server/auth', async (original) =>
  (await import('../../../../../tools/dbTest/routeHarness')).mockAuth(await original()),
);

const db = useRouteDatabase();
let POST: (req: Request) => Promise<Response>;

beforeAll(async () => {
  ({ POST } = await import('./route'));
});

const USER = 'user-a';
const STAGE = 'e-10000-0';

function fail(body: unknown) {
  return callRoute(POST, { path: '/api/endless/fail', body });
}

async function prepare(attempt: Partial<SeedAttempt> = {}) {
  await seedUser(db, USER);
  await seedStage(db, { id: STAGE, plays: 4, clears: 2, clearTotalMs: 40000, avgClearMs: 20000 });
  await seedAttempt(db, { id: 'key-1', userId: USER, stageCode: STAGE, issuedAt: secondsBefore(ACTIVE_NOW, 30), ...attempt });
  signInAs(USER);
}

describe('POST /api/endless/fail', () => {
  it('세션이 없으면 401을 반환한다', async () => {
    expect(await fail({ attemptKey: 'key-1' })).toEqual({ status: 401, body: { ok: false, msg: '로그인이 필요해요.' } });
  });

  it('요청 형식이 틀리면 400을 반환한다', async () => {
    signInAs(USER);
    expect(await fail({ attemptKey: '' })).toEqual({ status: 400, body: { ok: false, msg: '요청이 올바르지 않아요.' } });
  });

  it('실패를 기록하면 진행 시도 수와 판 플레이 수를 늘리고 연속 기록을 초기화한다', async () => {
    await prepare();
    await db.query(`insert into "EndlessStreak" ("userId", current, best) values ($1, 4, 6)`, [USER]);

    const res = await fail({ attemptKey: 'key-1' });

    expect(res).toEqual({ status: 200, body: { ok: true } });
    expect(await db.query(`select "usedAt" from "Attempt"`)).toEqual([{ usedAt: ACTIVE_NOW }]);
    expect(await db.query(`select "userId", "stageId", cleared, attempts, "lastPlayedAt" from "EndlessProgress"`)).toEqual([
      { userId: USER, stageId: STAGE, cleared: false, attempts: 1, lastPlayedAt: ACTIVE_NOW },
    ]);
    expect(await db.query(`select current, best from "EndlessStreak"`)).toEqual([{ current: 0, best: 6 }]);
    expect(
      await db.query(`select plays, clears, "clearTotalMs"::int as "clearTotalMs", "avgClearMs" from "EndlessStage"`),
    ).toEqual([{ plays: 5, clears: 2, clearTotalMs: 40000, avgClearMs: 20000 }]);
    expect(await db.query(`select 1 from "EndlessEvent"`)).toHaveLength(0);
    expect(await db.query(`select 1 from "SeedLedger"`)).toHaveLength(0);
  });

  it('연속 기록이 없던 사용자는 0으로 시작한다', async () => {
    await prepare();
    await fail({ attemptKey: 'key-1' });
    expect(await db.query(`select current, best from "EndlessStreak"`)).toEqual([{ current: 0, best: 0 }]);
  });

  it('이미 클리어한 판의 실패는 클리어 상태를 유지하고 시도 수만 늘린다', async () => {
    await prepare();
    await db.query(
      `insert into "EndlessProgress" ("userId", "stageId", cleared, attempts, "lastPlayedAt") values ($1, $2, true, 2, $3)`,
      [USER, STAGE, secondsBefore(ACTIVE_NOW, 3600)],
    );

    await fail({ attemptKey: 'key-1' });

    expect(await db.query(`select cleared, attempts, "lastPlayedAt" from "EndlessProgress"`)).toEqual([
      { cleared: true, attempts: 3, lastPlayedAt: ACTIVE_NOW },
    ]);
  });

  it.each<[string, Partial<SeedAttempt>]>([
    ['없는 키', { id: 'other-key' }],
    ['다른 사용자의 키', { userId: 'user-b' }],
    ['사용한 키', { usedAt: secondsBefore(ACTIVE_NOW, 5) }],
    ['유효 시간이 지난 키', { issuedAt: secondsBefore(ACTIVE_NOW, 2 * 60 * 60 + 1) }],
    ['스테이지 모드의 키', { stageCode: '1-1' }],
  ])('%s는 403으로 거절하고 아무것도 기록하지 않는다', async (_label, override) => {
    await prepare(override);

    const res = await fail({ attemptKey: 'key-1' });

    expect(res).toEqual({ status: 403, body: { ok: false, msg: '입장 키가 유효하지 않아요.' } });
    expect(await db.query(`select "usedAt" from "Attempt"`)).toEqual([{ usedAt: override.usedAt ?? null }]);
    expect(await db.query(`select 1 from "EndlessProgress"`)).toHaveLength(0);
    expect(await db.query(`select plays from "EndlessStage"`)).toEqual([{ plays: 4 }]);
    expect(sentryLogs).toEqual([{ level: 'warn', message: 'Endless fail rejected', attributes: { status: 403 } }]);
  });
});
