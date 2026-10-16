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
