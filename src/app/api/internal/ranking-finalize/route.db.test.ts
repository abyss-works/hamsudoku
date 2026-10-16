import { beforeAll, describe, expect, it, vi } from 'vitest';
import { seasonId, seasonWindow } from '../../../../shared/season';
import {
  ACTIVE_NOW,
  FROZEN_NOW,
  STAGE_SOLUTION_PAIRS,
  callRoute,
  internalAuth,
  qstashSigned,
  secondsBefore,
  seedAttempt,
  seedLedger,
  seedStage,
  seedUser,
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
let GET: (req: Request) => Promise<Response>;
let clear: (req: Request) => Promise<Response>;

beforeAll(async () => {
  ({ POST, GET } = await import('./route'));
  ({ POST: clear } = await import('../../endless/clear/route'));
});

const PATH = '/api/internal/ranking-finalize';
const SEASON = seasonId(ACTIVE_NOW);
const PREVIOUS = seasonId(new Date(ACTIVE_NOW.getTime() - 7 * 24 * 60 * 60 * 1000));

function finalize(body: unknown, headers: Record<string, string> = internalAuth()) {
  return callRoute(POST, { path: PATH, body, headers });
}

async function seedSeason(season: string, at: Date) {
  await seedLedger(db, { id: `${season}-1`, userId: 'user-a', season, amount: 4, createdAt: at });
  await seedLedger(db, { id: `${season}-2`, userId: 'user-b', season, amount: 6, createdAt: at });
  await seedLedger(db, { id: `${season}-3`, userId: 'user-c', season, amount: 4, createdAt: at });
  await seedLedger(db, { id: `${season}-4`, userId: 'user-a', season, amount: 1, createdAt: at });
  await seedLedger(db, { id: `${season}-5`, userId: 'user-d', season, amount: 30, createdAt: at, rankingEligible: false });
}

const SEASON_RESULTS = [
  { userId: 'user-b', score: 6, rank: 1 },
  { userId: 'user-a', score: 5, rank: 2 },
  { userId: 'user-c', score: 4, rank: 3 },
];

describe('POST /api/internal/ranking-finalize', () => {
  it('인증이 없으면 401을 반환한다', async () => {
    expect(await finalize({ season: SEASON }, {})).toEqual({ status: 401, body: { ok: false, msg: '인증에 실패했어요.' } });
  });

  it.each([['{"season":"2026-W99"}'], ['{"unknown":true}'], ['not-json']])('본문 %s는 400을 반환한다', async (rawBody) => {
    expect(await callRoute(POST, { path: PATH, rawBody, headers: internalAuth() })).toEqual({
      status: 400,
      body: { ok: false, msg: '잘못된 본문 형식이에요.' },
    });
  });

  it('끝나지 않은 시즌은 확정하지 않고 500을 반환한다', async () => {
    const res = await finalize({ season: SEASON });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      ok: false,
      msg: `Season ${SEASON} has not ended yet (ends at ${seasonWindow(SEASON).endAt.toISOString()})`,
    });
    expect(await db.query(`select 1 from "SeasonFinalization"`)).toHaveLength(0);
  });

  it('끝난 시즌을 점수 내림차순과 userId 내림차순으로 확정하고 저장한다', async () => {
    useFixedNow(FROZEN_NOW);
    await seedSeason(SEASON, secondsBefore(ACTIVE_NOW, 3600));

    const res = await finalize({ season: SEASON });

    expect(res).toEqual({
      status: 200,
      body: {
        ok: true,
        season: SEASON,
        results: SEASON_RESULTS.map((r) => ({ season: SEASON, ...r })),
        recoveredSeasons: [],
      },
    });
    const window = seasonWindow(SEASON);
    expect(await db.query(`select season, "startAt", "endAt", "finalizedAt", status from "SeasonFinalization"`)).toEqual([
      { season: SEASON, startAt: window.startAt, endAt: window.endAt, finalizedAt: FROZEN_NOW, status: 'finalized' },
    ]);
    expect(await db.query(`select "userId", score, rank from "SeasonRankResult" order by rank`)).toEqual(SEASON_RESULTS);
  });

  it('QStash 서명 요청도 인증한다', async () => {
    useFixedNow(FROZEN_NOW);
    await seedSeason(SEASON, secondsBefore(ACTIVE_NOW, 3600));
    const rawBody = JSON.stringify({ season: SEASON });

    const res = await callRoute(POST, { path: PATH, rawBody, headers: qstashSigned(PATH, rawBody) });

    expect(res.status).toBe(200);
    expect(await db.query(`select status from "SeasonFinalization"`)).toEqual([{ status: 'finalized' }]);
  });

  it('이미 확정된 시즌은 기존 결과를 반환하고 다시 집계하지 않는다', async () => {
    useFixedNow(FROZEN_NOW);
    await seedSeason(SEASON, secondsBefore(ACTIVE_NOW, 3600));
    await finalize({ season: SEASON });
    await seedLedger(db, { id: 'late', userId: 'user-z', season: SEASON, amount: 50, createdAt: secondsBefore(ACTIVE_NOW, 60) });

    const res = await finalize({ season: SEASON });

    expect(res.body).toMatchObject({ ok: true, results: SEASON_RESULTS.map((r) => ({ season: SEASON, ...r })) });
    expect(await db.query(`select 1 from "SeasonRankResult"`)).toHaveLength(3);
  });

  it('참여자가 없는 시즌도 빈 결과로 확정한다', async () => {
    useFixedNow(FROZEN_NOW);
    const res = await finalize({ season: SEASON });
    expect(res.body).toEqual({ ok: true, season: SEASON, results: [], recoveredSeasons: [] });
    expect(await db.query(`select season from "SeasonFinalization"`)).toEqual([{ season: SEASON }]);
  });

  it('시즌 지정이 없으면 원장에 있는 끝난 미확정 시즌을 모두 확정한다', async () => {
    useFixedNow(FROZEN_NOW);
    await seedSeason(SEASON, secondsBefore(ACTIVE_NOW, 3600));
    await seedSeason(PREVIOUS, secondsBefore(ACTIVE_NOW, 7 * 24 * 3600));
    const current = seasonId(FROZEN_NOW);
    await seedLedger(db, { id: 'current', userId: 'user-a', season: current, amount: 2, createdAt: FROZEN_NOW });

    const res = await finalize({});

    expect(res).toEqual({ status: 200, body: { ok: true, recoveredSeasons: [PREVIOUS, SEASON] } });
    expect(await db.query(`select season from "SeasonFinalization" order by season`)).toEqual([
      { season: PREVIOUS },
      { season: SEASON },
    ]);
  });

  it('시즌 확정과 함께 복구를 요청하면 다른 미확정 시즌도 확정한다', async () => {
    useFixedNow(FROZEN_NOW);
    await seedSeason(SEASON, secondsBefore(ACTIVE_NOW, 3600));
    await seedSeason(PREVIOUS, secondsBefore(ACTIVE_NOW, 7 * 24 * 3600));

    const res = await finalize({ season: SEASON, recover: true });

    expect(res.body).toMatchObject({ ok: true, season: SEASON, recoveredSeasons: [PREVIOUS] });
  });

  it('GET 요청도 같은 확정 동작을 수행한다', async () => {
    useFixedNow(FROZEN_NOW);
    await seedSeason(SEASON, secondsBefore(ACTIVE_NOW, 3600));
    const res = await callRoute(GET, { path: PATH, method: 'GET', headers: internalAuth() });
    expect(res.body).toEqual({ ok: true, recoveredSeasons: [SEASON] });
  });

  it('시즌 종료 직전에 시작한 클리어와 시즌 확정이 겹쳐도 확정 결과는 랭킹 대상 원장과 일치한다', async () => {
    const endAt = seasonWindow(SEASON).endAt;
    useFixedNow(new Date(endAt.getTime() - 1));
    await seedSeason(SEASON, secondsBefore(ACTIVE_NOW, 3600));
    await seedStage(db, { id: 'e-10000-0' });
    const users = ['user-a', 'user-x', 'user-y'];
    for (const uid of users) {
      await seedUser(db, uid);
      await seedAttempt(db, { id: `key-${uid}`, userId: uid, stageCode: 'e-10000-0', issuedAt: secondsBefore(endAt, 10) });
    }

    const clears = users.map(async (uid) => {
      signInAs(uid);
      return callRoute(clear, {
        path: '/api/endless/clear',
        body: { attemptKey: `key-${uid}`, stageId: 'e-10000-0', solution: STAGE_SOLUTION_PAIRS, seedLeft: 3 },
      });
    });
    // 클리어가 제출 시각을 정한 뒤 시즌 종료 이후로 시각을 옮겨 확정을 시작한다. 실행 순서와 무관하게 단언이 성립한다.
    await new Promise((resolve) => setTimeout(resolve, 20));
    vi.setSystemTime(new Date(endAt.getTime() + 1000));
    const [finalized, ...cleared] = await Promise.all([finalize({ season: SEASON }), ...clears]);

    expect(finalized.status).toBe(200);
    expect(cleared.map((r) => r.body.ok)).toEqual([true, true, true]);
    const eligible = await db.query(
      `select "userId", sum(amount)::int as score from "SeedLedger"
       where season = $1 and "rankingEligible" group by "userId" order by "userId"`,
      [SEASON],
    );
    expect(await db.query(`select "userId", score from "SeasonRankResult" order by "userId"`)).toEqual(eligible);
  });

  it('집계 마감 창의 시즌 확정과 클리어를 함께 실행해도 확정 결과는 끝난 시즌 원장만 반영한다', async () => {
    useFixedNow(FROZEN_NOW);
    await seedSeason(SEASON, secondsBefore(ACTIVE_NOW, 3600));
    await seedStage(db, { id: 'e-10000-0' });
    const users = ['user-a', 'user-b', 'user-x'];
    for (const uid of users) {
      await seedUser(db, uid);
      await seedAttempt(db, { id: `key-${uid}`, userId: uid, stageCode: 'e-10000-0', issuedAt: secondsBefore(FROZEN_NOW, 10) });
    }

    const clears = users.map(async (uid) => {
      signInAs(uid);
      return callRoute(clear, {
        path: '/api/endless/clear',
        body: { attemptKey: `key-${uid}`, stageId: 'e-10000-0', solution: STAGE_SOLUTION_PAIRS, seedLeft: 3 },
      });
    });
    const [finalized, ...cleared] = await Promise.all([finalize({ season: SEASON }), ...clears]);

    expect(cleared.map((r) => r.body.ok)).toEqual([true, true, true]);
    expect(finalized.body).toMatchObject({ ok: true, results: SEASON_RESULTS.map((r) => ({ season: SEASON, ...r })) });
    expect(
      await db.query(`select season, "rankingEligible", count(*)::int as n from "SeedLedger" where "stageId" is not null group by 1, 2`),
    ).toEqual([{ season: seasonId(FROZEN_NOW), rankingEligible: false, n: 3 }]);
  });
});
