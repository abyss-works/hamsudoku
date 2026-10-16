import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ACTIVE_NOW,
  callRoute,
  secondsBefore,
  seedAttempt,
  type SeedAttempt,
  seedUser,
  signInAs,
  useRouteDatabase,
} from '../../../../tools/dbTest/routeHarness';

vi.mock('next/server', async (original) =>
  (await import('../../../../tools/dbTest/routeHarness')).mockNextServer(await original()),
);
vi.mock('../../../server/auth', async (original) =>
  (await import('../../../../tools/dbTest/routeHarness')).mockAuth(await original()),
);

const db = useRouteDatabase();
let POST: (req: Request) => Promise<Response>;

beforeAll(async () => {
  ({ POST } = await import('./route'));
});

const USER = 'user-a';

function submit(body: unknown) {
  return callRoute(POST, { path: '/api/clear', body });
}

async function prepare(attempt: Partial<SeedAttempt> = {}) {
  await seedUser(db, USER);
  await seedAttempt(db, { id: 'key-1', userId: USER, stageCode: '2-5', issuedAt: secondsBefore(ACTIVE_NOW, 95), ...attempt });
  signInAs(USER);
}

describe('POST /api/clear', () => {
  it('세션이 없으면 401을 반환한다', async () => {
    expect(await submit({ elapsedSec: 10, stageCode: '2-5' })).toEqual({
      status: 401,
      body: { ok: false, msg: '로그인이 필요해요.' },
    });
  });

  it.each([[{}], [{ elapsedSec: -1, stageCode: '2-5' }], [{ elapsedSec: 1.5, stageCode: '2-5' }], [{ elapsedSec: 10 }]])(
    '요청 형식이 틀리면 400을 반환한다 (%j)',
    async (body) => {
      await seedUser(db, USER);
      signInAs(USER);
      expect(await submit(body)).toEqual({ status: 400, body: { ok: false, msg: '요청을 확인하세요.' } });
    },
  );

  it('입장 키 클리어는 발급 후 경과 시간으로 기록하고 키를 소모한다', async () => {
    await prepare();

    const res = await submit({ attemptKey: 'key-1', elapsedSec: 3 });

    expect(res).toEqual({ status: 200, body: { ok: true, bestElapsedSec: 95 } });
    expect(await db.query(`select "usedAt" from "Attempt"`)).toEqual([{ usedAt: ACTIVE_NOW }]);
    expect(
      await db.query(`select "userId", "stageCode", "bestElapsedSec", attempts, "lastClearedAt", "updatedAt" from "ClearRecord"`),
    ).toEqual([
      { userId: USER, stageCode: '2-5', bestElapsedSec: 95, attempts: 1, lastClearedAt: ACTIVE_NOW, updatedAt: ACTIVE_NOW },
    ]);
    expect(await db.query(`select "userId", "stageCode", "elapsedSec", verified, "clearedAt" from "ClearEvent"`)).toEqual([
      { userId: USER, stageCode: '2-5', elapsedSec: 95, verified: true, clearedAt: ACTIVE_NOW },
    ]);
  });

  it('기존 기록보다 느린 클리어는 최고 기록을 유지하고 횟수와 최근 시각을 갱신한다', async () => {
    await prepare();
    const earlier = secondsBefore(ACTIVE_NOW, 3600);
    await db.query(
      `insert into "ClearRecord" ("userId", "stageCode", "bestElapsedSec", attempts, "lastClearedAt", "updatedAt")
       values ($1, '2-5', 60, 3, $2, $2)`,
      [USER, earlier],
    );

    const res = await submit({ attemptKey: 'key-1', elapsedSec: 3 });

    expect(res.body).toEqual({ ok: true, bestElapsedSec: 60 });
    expect(await db.query(`select "bestElapsedSec", attempts, "lastClearedAt" from "ClearRecord"`)).toEqual([
      { bestElapsedSec: 60, attempts: 4, lastClearedAt: ACTIVE_NOW },
    ]);
  });

  it.each<[string, Partial<SeedAttempt>]>([
    ['다른 사용자의 키', { userId: 'user-b' }],
    ['사용한 키', { usedAt: secondsBefore(ACTIVE_NOW, 5) }],
    ['무한모드 판의 키', { stageCode: 'e-10000-0' }],
    ['유효 시간이 지난 키', { issuedAt: secondsBefore(ACTIVE_NOW, 2 * 60 * 60 + 1) }],
  ])('%s는 403으로 거절하고 키와 기록을 바꾸지 않는다', async (_label, override) => {
    await prepare(override);

    const res = await submit({ attemptKey: 'key-1', elapsedSec: 3 });

    expect(res).toEqual({ status: 403, body: { ok: false, msg: '입장 키가 유효하지 않아요.' } });
    expect(await db.query(`select "usedAt" from "Attempt"`)).toEqual([{ usedAt: override.usedAt ?? null }]);
    expect(await db.query(`select 1 from "ClearRecord"`)).toHaveLength(0);
    expect(await db.query(`select 1 from "ClearEvent"`)).toHaveLength(0);
  });

  it('없는 키는 403으로 거절한다', async () => {
    await prepare();
    expect((await submit({ attemptKey: 'missing', elapsedSec: 3 })).status).toBe(403);
  });

  it('입장 키 없는 클리어는 미검증 이벤트만 남긴다', async () => {
    await seedUser(db, USER);
    signInAs(USER);

    const res = await submit({ elapsedSec: 42, stageCode: '4-2' });

    expect(res).toEqual({ status: 200, body: { ok: true } });
    expect(await db.query(`select "userId", "stageCode", "elapsedSec", verified, "clearedAt" from "ClearEvent"`)).toEqual([
      { userId: USER, stageCode: '4-2', elapsedSec: 42, verified: false, clearedAt: ACTIVE_NOW },
    ]);
    expect(await db.query(`select 1 from "ClearRecord"`)).toHaveLength(0);
  });
});
