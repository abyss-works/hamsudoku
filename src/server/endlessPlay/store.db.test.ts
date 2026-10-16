import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { useStoreDatabase } from '../../../tools/dbTest/storeHarness';
import { findPlaySummary, listRecentPlayEvents, pickUnclearedStage } from './queries';
import { appendPlayEvent, commitClear, commitFail, lockPlayer } from './store';

const store = useStoreDatabase();

const AT = new Date('2026-10-21T03:00:00.000Z');
const LATER = new Date('2026-10-21T03:05:00.000Z');

async function seedStage(id: string) {
  await store.query(
    `insert into "EndlessStage" (id, size, regions, solution, tier, seed) values ($1, 7, $2, '0,0', 1, 10000)`,
    [id, '0123456'.repeat(7)],
  );
}

describe('endlessPlay 클리어 커밋', () => {
  it('첫 클리어는 진행·지갑·연속 기록·검증 이벤트를 한 번에 만들고 잔액과 연속 기록을 반환한다', async () => {
    const result = await store.withTransaction((tx) =>
      commitClear(tx, { userId: 'user-a', stageId: 'e-1-0', seedLeft: 3, elapsedMs: 12000, suspicious: false, at: AT }),
    );

    expect(result).toEqual({ balance: 3, streak: { current: 1, best: 1 } });
    expect(await store.query(`select "userId", "stageId", cleared, attempts, "lastPlayedAt" from "EndlessProgress"`)).toEqual([
      { userId: 'user-a', stageId: 'e-1-0', cleared: true, attempts: 1, lastPlayedAt: AT },
    ]);
    expect(await store.query(`select "userId", balance from "SeedWallet"`)).toEqual([{ userId: 'user-a', balance: 3 }]);
    expect(
      await store.query(`select "userId", "stageId", "seedLeft", "elapsedMs", verified, suspicious, reason, "createdAt" from "EndlessEvent"`),
    ).toEqual([
      { userId: 'user-a', stageId: 'e-1-0', seedLeft: 3, elapsedMs: 12000, verified: true, suspicious: false, reason: null, createdAt: AT },
    ]);
  });

  it('기존 기록에 더해 잔액과 시도 수를 늘리고 씨앗 3개가 아니면 연속 기록을 초기화한다', async () => {
    await store.query(`insert into "SeedWallet" ("userId", balance) values ('user-a', 10)`);
    await store.query(`insert into "EndlessStreak" ("userId", current, best) values ('user-a', 4, 6)`);
    await store.query(
      `insert into "EndlessProgress" ("userId", "stageId", cleared, attempts, "lastPlayedAt") values ('user-a', 'e-1-0', false, 2, $1)`,
      [AT],
    );

    const result = await store.withTransaction((tx) =>
      commitClear(tx, { userId: 'user-a', stageId: 'e-1-0', seedLeft: 2, elapsedMs: 9000, suspicious: true, at: LATER }),
    );

    expect(result).toEqual({ balance: 12, streak: { current: 0, best: 6 } });
    expect(await store.query(`select cleared, attempts, "lastPlayedAt" from "EndlessProgress"`)).toEqual([
      { cleared: true, attempts: 3, lastPlayedAt: LATER },
    ]);
    expect(await store.query(`select suspicious from "EndlessEvent"`)).toEqual([{ suspicious: true }]);
  });

  it('씨앗 3개 클리어는 연속 기록을 늘리고 최고 기록을 갱신한다', async () => {
    await store.query(`insert into "EndlessStreak" ("userId", current, best) values ('user-a', 6, 6)`);
    const result = await store.withTransaction((tx) =>
      commitClear(tx, { userId: 'user-a', stageId: 'e-1-0', seedLeft: 3, elapsedMs: 9000, suspicious: false, at: AT }),
    );
    expect(result.streak).toEqual({ current: 7, best: 7 });
  });
});

describe('endlessPlay 실패 커밋', () => {
  it('진행 시도 수를 늘리고 클리어 상태를 유지하며 연속 기록을 초기화한다', async () => {
    await store.query(`insert into "EndlessStreak" ("userId", current, best) values ('user-a', 4, 6)`);
    await store.query(
      `insert into "EndlessProgress" ("userId", "stageId", cleared, attempts, "lastPlayedAt") values ('user-a', 'e-1-0', true, 2, $1)`,
      [AT],
    );

    await store.withTransaction((tx) => commitFail(tx, { userId: 'user-a', stageId: 'e-1-0', at: LATER }));

    expect(await store.query(`select cleared, attempts, "lastPlayedAt" from "EndlessProgress"`)).toEqual([
      { cleared: true, attempts: 3, lastPlayedAt: LATER },
    ]);
    expect(await store.query(`select current, best from "EndlessStreak"`)).toEqual([{ current: 0, best: 6 }]);
  });

  it('처음 실패하면 미클리어 진행과 0인 연속 기록을 만든다', async () => {
    await store.withTransaction((tx) => commitFail(tx, { userId: 'user-a', stageId: 'e-1-0', at: AT }));
    expect(await store.query(`select cleared, attempts from "EndlessProgress"`)).toEqual([{ cleared: false, attempts: 1 }]);
    expect(await store.query(`select current, best from "EndlessStreak"`)).toEqual([{ current: 0, best: 0 }]);
  });
});

describe('endlessPlay 이벤트와 잠금', () => {
  it('무효 제출 이벤트를 사유와 함께 기록한다', async () => {
    await appendPlayEvent(store.db, { userId: 'user-a', stageId: 'e-1-0', seedLeft: 2, elapsedMs: 1500, reason: '하한 미달', at: AT });
    expect(
      await store.query(`select "seedLeft", "elapsedMs", verified, suspicious, reason, "createdAt" from "EndlessEvent"`),
    ).toEqual([{ seedLeft: 2, elapsedMs: 1500, verified: false, suspicious: false, reason: '하한 미달', createdAt: AT }]);
  });

  it('최근 이벤트는 기록 시각 역순으로 지정한 개수만 반환한다', async () => {
    for (let i = 0; i < 4; i += 1) {
      await store.query(
        `insert into "EndlessEvent" ("userId", "stageId", "seedLeft", "elapsedMs", verified, "createdAt") values ('user-a', 'e-1-0', $1, 1000, $2, $3)`,
        [i, i % 2 === 0, new Date(AT.getTime() + i * 1000)],
      );
    }
    await store.query(
      `insert into "EndlessEvent" ("userId", "stageId", "seedLeft", "elapsedMs", verified, "createdAt") values ('user-b', 'e-1-0', 3, 1000, true, $1)`,
      [LATER],
    );

    expect(await listRecentPlayEvents(store.db, 'user-a', 3)).toEqual([
      { seedLeft: 3, verified: false, createdAt: new Date(AT.getTime() + 3000) },
      { seedLeft: 2, verified: true, createdAt: new Date(AT.getTime() + 2000) },
      { seedLeft: 1, verified: false, createdAt: new Date(AT.getTime() + 1000) },
    ]);
  });

  it('같은 사용자의 잠금은 트랜잭션이 끝날 때까지 다음 잠금을 기다리게 한다', async () => {
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let held!: () => void;
    const acquired = new Promise<void>((resolve) => (held = resolve));
    const holder = store.withTransaction(async (tx) => {
      await lockPlayer(tx, 'user-a');
      held();
      await released;
    });
    await acquired;

    const blocked = await store
      .withTransaction(async (tx) => {
        await tx.execute(sql`set local lock_timeout = '300ms'`);
        await lockPlayer(tx, 'user-a');
      })
      .then(() => false)
      .catch((e: { cause?: { code?: string } }) => e.cause?.code === '55P03');
    const other = await store.withTransaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '300ms'`);
      await lockPlayer(tx, 'user-b');
      return true;
    });

    release();
    await holder;
    expect(blocked).toBe(true);
    expect(other).toBe(true);
  });
});

describe('endlessPlay 조회', () => {
  it('미클리어 판만 고르고 없으면 null이다', async () => {
    await seedStage('e-1-0');
    await seedStage('e-1-1');
    await store.query(
      `insert into "EndlessProgress" ("userId", "stageId", cleared, attempts, "lastPlayedAt") values
       ('user-a', 'e-1-0', true, 1, $1), ('user-a', 'e-1-1', false, 3, $1), ('user-b', 'e-1-1', true, 1, $1)`,
      [AT],
    );

    for (let i = 0; i < 3; i += 1) {
      expect(await pickUnclearedStage(store.db, 'user-a')).toEqual({
        id: 'e-1-1',
        size: 7,
        regions: '0123456'.repeat(7),
        solution: '0,0',
      });
    }
    expect(await pickUnclearedStage(store.db, 'user-b')).toMatchObject({ id: 'e-1-0' });
    await store.query(`update "EndlessProgress" set cleared = true`);
    expect(await pickUnclearedStage(store.db, 'user-a')).toBeNull();
  });

  it('요약은 잔액, 클리어한 판 수, 연속 기록을 한 문장으로 반환한다', async () => {
    expect(await findPlaySummary(store.db, 'user-a')).toEqual({ balance: 0, clearedCount: 0, streak: { current: 0, best: 0 } });

    await store.query(`insert into "SeedWallet" ("userId", balance) values ('user-a', 17), ('user-b', 99)`);
    await store.query(`insert into "EndlessStreak" ("userId", current, best) values ('user-a', 2, 5)`);
    await store.query(
      `insert into "EndlessProgress" ("userId", "stageId", cleared, attempts, "lastPlayedAt") values
       ('user-a', 'e-1-0', true, 1, $1), ('user-a', 'e-1-1', true, 3, $1), ('user-a', 'e-1-2', false, 2, $1)`,
      [AT],
    );
    expect(await findPlaySummary(store.db, 'user-a')).toEqual({ balance: 17, clearedCount: 2, streak: { current: 2, best: 5 } });
  });
});
