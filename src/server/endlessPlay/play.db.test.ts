import { beforeAll, describe, expect, it, vi } from 'vitest';
import { seasonId } from '../../shared/season';
import {
  ACTIVE_NOW,
  STAGE_SOLUTION_PAIRS,
  secondsBefore,
  seedAttempt,
  seedStage,
  useRouteDatabase,
} from '../../../tools/dbTest/routeHarness';

const failure = vi.hoisted(() => ({ clear: false, fail: false }));

vi.mock('./store', async (original) => {
  const actual = await original<typeof import('./store')>();
  return {
    ...actual,
    commitClear: async (...args: Parameters<typeof actual.commitClear>) => {
      if (failure.clear) {
        failure.clear = false;
        throw new Error('clear commit failed');
      }
      return actual.commitClear(...args);
    },
    commitFail: async (...args: Parameters<typeof actual.commitFail>) => {
      if (failure.fail) {
        failure.fail = false;
        throw new Error('fail commit failed');
      }
      return actual.commitFail(...args);
    },
  };
});

const db = useRouteDatabase();
let play: typeof import('./play');
let database: typeof import('../db/client');
let ranking: typeof import('../seasonRanking/store');

beforeAll(async () => {
  play = await import('./play');
  database = await import('../db/client');
  ranking = await import('../seasonRanking/store');
});

const STAGE = 'e-10000-0';
const noDefer = () => {};

async function prepare(key = 'key-1', userId = 'user-a') {
  await seedAttempt(db, { id: key, userId, stageCode: STAGE, issuedAt: secondsBefore(ACTIVE_NOW, 10) });
}

function clear(key = 'key-1', userId = 'user-a') {
  return play.submitEndlessClear(
    userId,
    { attemptKey: key, stageId: STAGE, solution: STAGE_SOLUTION_PAIRS, seedLeft: 2 },
    ACTIVE_NOW.toISOString(),
    noDefer,
  );
}

/** 다른 연결이 잠금을 잡은 동안 작업을 실행한다. */
async function whileHolding<T>(lock: (tx: Parameters<typeof ranking.lockSeasonForEarning>[0]) => Promise<void>, work: () => Promise<T>) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  let held!: () => void;
  const acquired = new Promise<void>((resolve) => (held = resolve));
  const holder = database.withTransaction(async (tx) => {
    await lock(tx);
    held();
    await released;
  });
  await acquired;
  return { result: work(), release: async () => { release(); await holder; } };
}

/**
 * 이 데이터베이스에서 advisory 잠금을 기다리는 연결이 보이면 resolve한다. 경과 시간 대신 잠금 대기 상태로
 * 판정한다. 판정이 끝나면 stop으로 조회를 멈춘다.
 */
function watchAdvisoryLockWait() {
  let stopped = false;
  const waiting = (async () => {
    while (!stopped) {
      const rows = await db.query(
        `select 1 from pg_stat_activity
         where datname = current_database() and wait_event_type = 'Lock' and wait_event = 'advisory'`,
      );
      if (rows.length > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  })();
  return {
    waiting,
    stop: async () => {
      stopped = true;
      await waiting;
    },
  };
}

describe('submitEndlessClear', () => {
  it('커밋이 실패하면 키 소모를 되돌려 같은 키로 다시 제출할 수 있다', async () => {
    await seedStage(db, { id: STAGE });
    await prepare();
    failure.clear = true;

    await expect(clear()).rejects.toThrow('clear commit failed');
    expect(await db.query(`select "usedAt" from "Attempt"`)).toEqual([{ usedAt: null }]);
    expect(await db.query(`select 1 from "SeedLedger"`)).toHaveLength(0);

    expect((await clear()).body).toMatchObject({ ok: true, earned: 2 });
  });

  it('무효 제출은 판 통계를 바꾸지 않는다', async () => {
    await seedStage(db, { id: STAGE, plays: 4, clears: 2 });
    await prepare();
    const result = await play.submitEndlessClear(
      'user-a',
      { attemptKey: 'key-1', stageId: STAGE, solution: [[0, 0]], seedLeft: 2 },
      ACTIVE_NOW.toISOString(),
      noDefer,
    );
    expect(result.body).toEqual({ ok: false, reason: '정답이 맞지 않아요.' });
    expect(await db.query(`select plays, clears from "EndlessStage"`)).toEqual([{ plays: 4, clears: 2 }]);
  });

  it('다른 클리어가 잡은 시즌 공유 잠금은 기다리지 않는다', async () => {
    await seedStage(db, { id: STAGE });
    await prepare();
    const held = await whileHolding(
      (tx) => ranking.lockSeasonForEarning(tx, seasonId(ACTIVE_NOW)),
      () => clear(),
    );
    const watch = watchAdvisoryLockWait();
    const outcome = await Promise.race([held.result.then(() => 'done'), watch.waiting.then(() => 'blocked')]);
    await watch.stop();
    await held.release();
    expect(outcome).toBe('done');
  });

  it('시즌 확정의 배타 잠금이 풀릴 때까지 커밋을 기다린다', async () => {
    await seedStage(db, { id: STAGE });
    await prepare();
    const held = await whileHolding(
      (tx) => ranking.lockSeasonForFinalization(tx, seasonId(ACTIVE_NOW)),
      () => clear(),
    );
    const watch = watchAdvisoryLockWait();
    const before = await Promise.race([held.result.then(() => 'done'), watch.waiting.then(() => 'waiting')]);
    await watch.stop();
    await held.release();
    expect(before).toBe('waiting');
    expect((await held.result).body).toMatchObject({ ok: true });
  });
});

describe('submitEndlessFail', () => {
  it('커밋이 실패하면 키 소모를 되돌려 같은 키로 다시 보고할 수 있다', async () => {
    await seedStage(db, { id: STAGE });
    await prepare();
    failure.fail = true;

    await expect(play.submitEndlessFail('user-a', { attemptKey: 'key-1' }, ACTIVE_NOW.toISOString())).rejects.toThrow(
      'fail commit failed',
    );
    expect(await db.query(`select "usedAt" from "Attempt"`)).toEqual([{ usedAt: null }]);
    expect(await db.query(`select plays from "EndlessStage"`)).toEqual([{ plays: 0 }]);

    expect(await play.submitEndlessFail('user-a', { attemptKey: 'key-1' }, ACTIVE_NOW.toISOString())).toEqual({ status: 200 });
  });
});

