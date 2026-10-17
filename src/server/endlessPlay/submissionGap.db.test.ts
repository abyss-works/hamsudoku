import { beforeAll, describe, expect, it } from 'vitest';
import {
  ACTIVE_NOW,
  STAGE_SOLUTION_PAIRS,
  secondsBefore,
  seedAttempt,
  seedStage,
  useRouteDatabase,
} from '../../../tools/dbTest/routeHarness';

const db = useRouteDatabase();
let submitEndlessClear: typeof import('./play').submitEndlessClear;

beforeAll(async () => {
  ({ submitEndlessClear } = await import('./play'));
});

describe('무한모드 제출 간격', () => {
  it('직전 검증 클리어 뒤에 무효 제출이 많이 쌓여도 1초 안의 제출은 거절한다', async () => {
    await seedStage(db, { id: 'e-10000-0' });
    await seedAttempt(db, { id: 'key-1', userId: 'user-a', stageCode: 'e-10000-0', issuedAt: secondsBefore(ACTIVE_NOW, 10) });
    await db.query(
      `insert into "EndlessEvent" ("userId", "stageId", "seedLeft", "elapsedMs", verified, "createdAt")
       values ('user-a', 'e-9-9', 2, 9000, true, $1)`,
      [new Date(ACTIVE_NOW.getTime() - 900)],
    );
    for (let i = 0; i < 25; i += 1) {
      await db.query(
        `insert into "EndlessEvent" ("userId", "stageId", "seedLeft", "elapsedMs", verified, reason, "createdAt")
         values ('user-a', 'e-9-9', 2, 100, false, '정답 불일치', $1)`,
        [new Date(ACTIVE_NOW.getTime() - 800 + i)],
      );
    }

    const result = await submitEndlessClear(
      'user-a',
      { attemptKey: 'key-1', stageId: 'e-10000-0', solution: STAGE_SOLUTION_PAIRS, seedLeft: 2 },
      ACTIVE_NOW.toISOString(),
      () => {},
    );

    expect(result.body).toEqual({ ok: false, reason: '제출이 너무 잦아요.' });
    expect(await db.query(`select 1 from "SeedLedger"`)).toHaveLength(0);
  });
});
