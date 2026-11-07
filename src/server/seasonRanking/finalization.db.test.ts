import { beforeAll, describe, expect, it } from 'vitest';
import { seasonWindow } from '../../shared/season';
import { useRouteDatabase } from '../../../tools/dbTest/routeHarness';

const db = useRouteDatabase();
let finalization: typeof import('./finalization');

beforeAll(async () => {
  finalization = await import('./finalization');
});

const SEASON = '2026-W41';
const WINDOW = seasonWindow(SEASON);
const AFTER_END = new Date(WINDOW.endAt.getTime() + 60_000);

describe('finalizeSeason 대량 참여', () => {
  it('바인드 매개변수 한도를 넘는 참여자 수도 한 번에 확정하고 순위를 매긴다', async () => {
    const participants = 17_000;
    await db.query(
      `insert into "SeedLedger" ("userId", kind, amount, season, "createdAt", "rankingEligible")
       select 'user-' || lpad(n::text, 5, '0'), 'earn', (n % 50) + 1, $1, $2, true from generate_series(1, $3) as n`,
      [SEASON, new Date(WINDOW.startAt.getTime() + 60_000), participants],
    );

    const result = await finalization.finalizeSeason(SEASON, AFTER_END);

    expect(result.results).toHaveLength(participants);
    expect(result.results.map((r) => r.rank)).toEqual(Array.from({ length: participants }, (_, i) => i + 1));
    expect(result.results[0]).toEqual({ season: SEASON, userId: 'user-16999', score: 50, rank: 1 });
    expect(await db.query(`select count(*)::int as n from "SeasonRankResult"`)).toEqual([{ n: participants }]);
  }, 120_000);

  it('끝나지 않은 시즌은 SeasonNotEndedError로 거절한다', async () => {
    await expect(finalization.finalizeSeason(SEASON, new Date(WINDOW.endAt.getTime() - 1))).rejects.toBeInstanceOf(
      finalization.SeasonNotEndedError,
    );
  });
});

describe('finalizeSeason 중복 호출', () => {
  it('같은 시즌을 동시에 여러 번 확정해도 머리 행과 결과를 한 번만 저장하고 같은 결과를 반환한다', async () => {
    const at = new Date(WINDOW.startAt.getTime() + 60_000);
    await db.query(
      `insert into "SeedLedger" ("userId", kind, amount, season, "createdAt", "rankingEligible")
       values ('user-a', 'earn', 4, $1, $2, true), ('user-b', 'earn', 6, $1, $2, true)`,
      [SEASON, at],
    );

    const results = await Promise.all([1, 2, 3, 4].map(() => finalization.finalizeSeason(SEASON, AFTER_END)));

    for (const result of results) {
      expect(result.results).toEqual([
        { season: SEASON, userId: 'user-b', score: 6, rank: 1 },
        { season: SEASON, userId: 'user-a', score: 4, rank: 2 },
      ]);
    }
    expect(await db.query(`select count(*)::int as n from "SeasonFinalization"`)).toEqual([{ n: 1 }]);
    expect(await db.query(`select count(*)::int as n from "SeasonRankResult"`)).toEqual([{ n: 2 }]);
  });

  it('확정된 시즌을 복구 경로로 다시 호출해도 결과가 늘지 않는다', async () => {
    await db.query(
      `insert into "SeedLedger" ("userId", kind, amount, season, "createdAt", "rankingEligible")
       values ('user-a', 'earn', 4, $1, $2, true)`,
      [SEASON, new Date(WINDOW.startAt.getTime() + 60_000)],
    );
    await finalization.finalizeSeason(SEASON, AFTER_END);

    const recovered = await finalization.recoverUnfinalizedSeasons(AFTER_END);

    expect(recovered.filter((r) => r.header.season === SEASON)).toHaveLength(0);
    expect(await db.query(`select count(*)::int as n from "SeasonRankResult"`)).toEqual([{ n: 1 }]);
  });
});
