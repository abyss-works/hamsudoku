import { beforeAll, describe, expect, it, vi } from 'vitest';
import { seasonId } from '../../../../shared/season';
import {
  ACTIVE_NOW,
  FROZEN_NOW,
  FakeRankStore,
  STAGE_SOLUTION_PAIRS,
  callRoute,
  rankStore,
  secondsBefore,
  seedAttempt,
  type SeedAttempt,
  seedStage,
  seedUser,
  sentryLogs,
  signInAs,
  useFixedNow,
  useRouteDatabase,
} from '../../../../../tools/dbTest/routeHarness';

vi.mock('@sentry/nextjs', async () => (await import('../../../../../tools/dbTest/routeHarness')).mockSentry());
vi.mock('next/server', async (original) =>
  (await import('../../../../../tools/dbTest/routeHarness')).mockNextServer(await original()),
);
vi.mock('../../../../server/auth', async (original) =>
  (await import('../../../../../tools/dbTest/routeHarness')).mockAuth(await original()),
);
vi.mock('../../../../server/rank', async (original) =>
  (await import('../../../../../tools/dbTest/routeHarness')).mockRank(await original()),
);

const db = useRouteDatabase();
let POST: (req: Request) => Promise<Response>;

beforeAll(async () => {
  ({ POST } = await import('./route'));
});

const USER = 'user-a';
const STAGE = 'e-10000-0';

async function prepare(options: { issuedSecondsAgo?: number; now?: Date } = {}) {
  const now = options.now ?? ACTIVE_NOW;
  await seedUser(db, USER);
  await seedStage(db, { id: STAGE, plays: 4, clears: 2, clearTotalMs: 40000, avgClearMs: 20000 });
  await seedAttempt(db, {
    id: 'key-1',
    userId: USER,
    stageCode: STAGE,
    issuedAt: secondsBefore(now, options.issuedSecondsAgo ?? 10),
  });
  signInAs(USER);
}

function submit(body: Record<string, unknown>) {
  return callRoute(POST, { path: '/api/endless/clear', body });
}

const validBody = { attemptKey: 'key-1', stageId: STAGE, solution: STAGE_SOLUTION_PAIRS, seedLeft: 2 };

describe('POST /api/endless/clear', () => {
  it('세션이 없으면 401을 반환한다', async () => {
    const res = await submit(validBody);
    expect(res).toEqual({ status: 401, body: { ok: false, msg: '로그인이 필요해요.' } });
  });

  it('요청 형식이 틀리면 400을 반환한다', async () => {
    signInAs(USER);
    const res = await submit({ attemptKey: 'key-1', stageId: STAGE, solution: [], seedLeft: 4 });
    expect(res).toEqual({ status: 400, body: { ok: false, msg: '요청이 올바르지 않아요.' } });
  });

  it('없는 판이면 거절하고 입장 키를 소모하지 않는다', async () => {
    await prepare();
    const res = await submit({ ...validBody, stageId: 'e-missing-0' });
    expect(res).toEqual({ status: 200, body: { ok: false, reason: '알 수 없는 판이에요.' } });
    const [attempt] = await db.query(`select "usedAt" from "Attempt" where id = 'key-1'`);
    expect(attempt.usedAt).toBeNull();
  });

  it.each<[string, Partial<SeedAttempt>]>([
    ['다른 사용자의 키', { userId: 'user-b' }],
    ['사용한 키', { usedAt: secondsBefore(ACTIVE_NOW, 5) }],
    ['유효 시간이 지난 키', { issuedAt: secondsBefore(ACTIVE_NOW, 2 * 60 * 60 + 1) }],
    ['다른 판의 키', { stageCode: 'e-10000-1' }],
  ])('%s는 거절하고 기록하지 않는다', async (_label, override) => {
    await seedUser(db, USER);
    await seedStage(db, { id: STAGE });
    await seedStage(db, { id: 'e-10000-1' });
    const original = { id: 'key-1', userId: USER, stageCode: STAGE, issuedAt: secondsBefore(ACTIVE_NOW, 10), usedAt: null };
    await seedAttempt(db, { ...original, ...override });
    signInAs(USER);

    const res = await submit(validBody);

    expect(res).toEqual({ status: 200, body: { ok: false, reason: '입장 키가 유효하지 않아요.' } });
    const [attempt] = await db.query<{ usedAt: Date | null }>(`select "usedAt" from "Attempt" where id = 'key-1'`);
    expect(attempt.usedAt).toEqual(override.usedAt ?? null);
    expect(await db.query(`select 1 from "EndlessEvent"`)).toHaveLength(0);
    expect(sentryLogs).toContainEqual({
      level: 'warn',
      message: 'Endless submission rejected',
      attributes: { stage_id: STAGE, reason: '입장 키가 유효하지 않아요.' },
    });
  });

  it.each([
    ['정답이 다르면', { solution: [[0, 0]] }, 10, '정답이 맞지 않아요.', '정답 불일치'],
    ['3초 안에 제출하면', {}, 2, '제출이 너무 빨라요.', '하한 미달'],
    ['잔여 씨앗이 없으면', { seedLeft: 0 }, 10, '잔여 씨앗이 없어요.', '잔여 씨앗 없음'],
  ])('%s 키를 소모하고 미검증 이벤트만 남긴다', async (_label, override, issuedSecondsAgo, reason, eventReason) => {
    await prepare({ issuedSecondsAgo });

    const res = await submit({ ...validBody, ...override });

    expect(res).toEqual({ status: 200, body: { ok: false, reason } });
    const [attempt] = await db.query<{ usedAt: Date }>(`select "usedAt" from "Attempt" where id = 'key-1'`);
    expect(attempt.usedAt).toEqual(ACTIVE_NOW);
    const events = await db.query(
      `select "userId", "stageId", "seedLeft", "elapsedMs", verified, suspicious, reason from "EndlessEvent"`,
    );
    expect(events).toEqual([
      {
        userId: USER,
        stageId: STAGE,
        seedLeft: 'seedLeft' in override ? override.seedLeft : 2,
        elapsedMs: issuedSecondsAgo * 1000,
        verified: false,
        suspicious: false,
        reason: eventReason,
      },
    ]);
    expect(await db.query(`select 1 from "SeedWallet"`)).toHaveLength(0);
    expect(await db.query(`select 1 from "SeedLedger"`)).toHaveLength(0);
    expect(await db.query(`select 1 from "EndlessProgress"`)).toHaveLength(0);
  });

  it('검증된 클리어는 진행·지갑·원장·연속 기록·이벤트·판 통계를 함께 반영한다', async () => {
    await prepare();
    rankStore.current = new FakeRankStore();

    const res = await submit(validBody);

    expect(res).toEqual({ status: 200, body: { ok: true, earned: 2, balance: 2, streak: 0, suspicious: false } });
    const season = seasonId(ACTIVE_NOW);
    const [attempt] = await db.query(`select "usedAt" from "Attempt" where id = 'key-1'`);
    expect(attempt.usedAt).toEqual(ACTIVE_NOW);
    expect(await db.query(`select "userId", "stageId", cleared, attempts, "lastPlayedAt" from "EndlessProgress"`)).toEqual([
      { userId: USER, stageId: STAGE, cleared: true, attempts: 1, lastPlayedAt: ACTIVE_NOW },
    ]);
    expect(await db.query(`select "userId", balance from "SeedWallet"`)).toEqual([{ userId: USER, balance: 2 }]);
    expect(
      await db.query(`select "userId", kind, amount, "stageId", season, "rankingEligible", "createdAt" from "SeedLedger"`),
    ).toEqual([
      { userId: USER, kind: 'earn', amount: 2, stageId: STAGE, season, rankingEligible: true, createdAt: ACTIVE_NOW },
    ]);
    expect(await db.query(`select "userId", current, best from "EndlessStreak"`)).toEqual([
      { userId: USER, current: 0, best: 0 },
    ]);
    expect(
      await db.query(`select "userId", "stageId", "seedLeft", "elapsedMs", verified, suspicious, reason from "EndlessEvent"`),
    ).toEqual([
      { userId: USER, stageId: STAGE, seedLeft: 2, elapsedMs: 10000, verified: true, suspicious: false, reason: null },
    ]);
    expect(
      await db.query(`select plays, clears, "clearTotalMs"::int as "clearTotalMs", "avgClearMs" from "EndlessStage"`),
    ).toEqual([{ plays: 5, clears: 3, clearTotalMs: 50000, avgClearMs: 16666 }]);
    expect(rankStore.current.increments).toEqual([{ season, userId: USER, amount: 2 }]);
    expect(sentryLogs).toContainEqual({
      level: 'info',
      message: 'Endless stage cleared',
      attributes: { stage_id: STAGE, season, earned: 2, suspicious: false },
    });
  });

  it('씨앗 3개 클리어는 연속 기록을 늘리고 최고 기록을 갱신한다', async () => {
    await prepare();
    await db.query(`insert into "EndlessStreak" ("userId", current, best) values ($1, 2, 2)`, [USER]);
    await db.query(`insert into "SeedWallet" ("userId", balance) values ($1, 7)`, [USER]);

    const res = await submit({ ...validBody, seedLeft: 3 });

    expect(res.body).toEqual({ ok: true, earned: 3, balance: 10, streak: 3, suspicious: false });
    expect(await db.query(`select current, best from "EndlessStreak"`)).toEqual([{ current: 3, best: 3 }]);
  });

  it('직전 검증 클리어와 1초 안의 제출은 거절한다', async () => {
    await prepare();
    await db.query(
      `insert into "EndlessEvent" (id, "userId", "stageId", "seedLeft", "elapsedMs", verified, suspicious, "createdAt")
       values ('ev-prev', $1, 'e-10000-9', 2, 9000, true, false, $2)`,
      [USER, new Date(ACTIVE_NOW.getTime() - 500)],
    );

    const res = await submit(validBody);

    expect(res.body).toEqual({ ok: false, reason: '제출이 너무 잦아요.' });
    expect(await db.query(`select reason from "EndlessEvent" where id <> 'ev-prev'`)).toEqual([{ reason: '제출 간격 하한' }]);
    expect(await db.query(`select 1 from "SeedWallet"`)).toHaveLength(0);
  });

  it('최근 20건 중 씨앗 3개 검증 클리어가 16건 이상이면 의심 표시를 남긴다', async () => {
    await prepare();
    for (let i = 0; i < 16; i += 1) {
      await db.query(
        `insert into "EndlessEvent" (id, "userId", "stageId", "seedLeft", "elapsedMs", verified, suspicious, "createdAt")
         values ($1, $2, 'e-10000-9', 3, 9000, true, false, $3)`,
        [`ev-${i}`, USER, secondsBefore(ACTIVE_NOW, 60 + i)],
      );
    }

    const res = await submit(validBody);

    expect(res.body).toMatchObject({ ok: true, suspicious: true });
    expect(await db.query(`select suspicious from "EndlessEvent" where verified and "stageId" = $1`, [STAGE])).toEqual([
      { suspicious: true },
    ]);
  });

  it('같은 키의 두 번째 제출은 거절한다', async () => {
    await prepare();
    await submit(validBody);
    const res = await submit(validBody);
    expect(res.body).toEqual({ ok: false, reason: '입장 키가 유효하지 않아요.' });
    expect(await db.query(`select balance from "SeedWallet"`)).toEqual([{ balance: 2 }]);
  });

  it('확정된 시즌의 적립은 랭킹 대상에서 제외한다', async () => {
    await prepare();
    const season = seasonId(ACTIVE_NOW);
    await db.query(
      `insert into "SeasonFinalization" (season, "startAt", "endAt", "finalizedAt", status) values ($1, $2, $2, $2, 'finalized')`,
      [season, ACTIVE_NOW],
    );

    const res = await submit(validBody);

    expect(res.body).toMatchObject({ ok: true });
    expect(await db.query(`select "rankingEligible" from "SeedLedger"`)).toEqual([{ rankingEligible: false }]);
  });

  it('집계 마감 창의 클리어는 지갑에만 적립하고 랭킹 적립을 하지 않는다', async () => {
    useFixedNow(FROZEN_NOW);
    await prepare({ now: FROZEN_NOW });
    rankStore.current = new FakeRankStore();

    const res = await submit(validBody);

    expect(res.body).toEqual({ ok: true, earned: 2, balance: 2, streak: 0, suspicious: false });
    expect(await db.query(`select season, "rankingEligible" from "SeedLedger"`)).toEqual([
      { season: seasonId(FROZEN_NOW), rankingEligible: false },
    ]);
    expect(rankStore.current.increments).toEqual([]);
  });

  it('서로 다른 사용자의 같은 판 동시 클리어는 모두 반영된다', async () => {
    await seedStage(db, { id: STAGE });
    for (const uid of ['user-a', 'user-b']) {
      await seedUser(db, uid);
      await seedAttempt(db, { id: `key-${uid}`, userId: uid, stageCode: STAGE, issuedAt: secondsBefore(ACTIVE_NOW, 10) });
    }

    const results = await Promise.all(
      ['user-a', 'user-b'].map(async (uid) => {
        // 세션은 요청을 시작할 때 읽는다.
        signInAs(uid);
        return submit({ ...validBody, attemptKey: `key-${uid}` });
      }),
    );

    expect(results.map((r) => r.body.ok)).toEqual([true, true]);
    expect(await db.query(`select plays, clears from "EndlessStage"`)).toEqual([{ plays: 2, clears: 2 }]);
    expect(await db.query(`select "userId", balance from "SeedWallet" order by "userId"`)).toEqual([
      { userId: 'user-a', balance: 2 },
      { userId: 'user-b', balance: 2 },
    ]);
  });

  it('같은 사용자의 동시 클리어는 한 건만 반영된다', async () => {
    // 직전 이벤트의 기록 시각과 제출 시각을 같은 시계로 비교하도록 실제 시각을 사용한다.
    vi.useRealTimers();
    const now = new Date();
    await seedUser(db, USER);
    for (const [index, stage] of ['e-10000-0', 'e-10000-1'].entries()) {
      await seedStage(db, { id: stage });
      await seedAttempt(db, { id: `key-${index}`, userId: USER, stageCode: stage, issuedAt: secondsBefore(now, 10) });
    }
    signInAs(USER);

    const results = await Promise.all([
      submit({ ...validBody, attemptKey: 'key-0', stageId: 'e-10000-0' }),
      submit({ ...validBody, attemptKey: 'key-1', stageId: 'e-10000-1' }),
    ]);

    expect(results.filter((r) => r.body.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.body.ok).map((r) => r.body)).toEqual([{ ok: false, reason: '제출이 너무 잦아요.' }]);
    expect(await db.query(`select balance from "SeedWallet"`)).toEqual([{ balance: 2 }]);
    expect(await db.query(`select 1 from "SeedLedger"`)).toHaveLength(1);
    expect(await db.query(`select 1 from "EndlessEvent" where verified`)).toHaveLength(1);
  });
});
