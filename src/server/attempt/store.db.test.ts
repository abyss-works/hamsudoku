import { describe, expect, it } from 'vitest';
import { useStoreDatabase } from '../../../tools/dbTest/storeHarness';
import { consumeAttempt, issueAttempt, releaseAttempt } from './store';

const store = useStoreDatabase();

const NOW = new Date('2026-10-21T03:00:00.000Z');
const TTL_MS = 2 * 60 * 60 * 1000;
const STAGE_PATTERN = '^[1-5]-([1-9]|10)$';

async function seed(attempt: { id: string; userId?: string; stageCode?: string; issuedAt?: Date; usedAt?: Date | null }) {
  await store.query(`insert into "Attempt" (id, "userId", "stageCode", "issuedAt", "usedAt") values ($1, $2, $3, $4, $5)`, [
    attempt.id,
    attempt.userId ?? 'user-a',
    attempt.stageCode ?? '2-5',
    attempt.issuedAt ?? new Date(NOW.getTime() - 60_000),
    attempt.usedAt ?? null,
  ]);
}

function consume(overrides: Partial<Parameters<typeof consumeAttempt>[1]> = {}) {
  return consumeAttempt(store.db, {
    key: 'key-1',
    userId: 'user-a',
    now: NOW,
    ttlMs: TTL_MS,
    stageCodePattern: STAGE_PATTERN,
    ...overrides,
  });
}

describe('attempt store', () => {
  it('입장 키를 발급하면 DB가 만든 id로 미사용 행을 저장한다', async () => {
    const issued = await issueAttempt(store.db, { userId: 'user-a', stageCode: '1-3', issuedAt: new Date() });

    expect(issued.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await store.query(`select id, "userId", "stageCode", "usedAt" from "Attempt"`)).toEqual([
      { id: issued.id, userId: 'user-a', stageCode: '1-3', usedAt: null },
    ]);
  });

  it('조건을 만족하는 키를 한 문장으로 소모하고 판 코드와 발급 시각을 반환한다', async () => {
    const issuedAt = new Date(NOW.getTime() - 95_000);
    await seed({ id: 'key-1', issuedAt });

    expect(await consume()).toEqual({ id: 'key-1', stageCode: '2-5', issuedAt });
    expect(await store.query(`select "usedAt" from "Attempt"`)).toEqual([{ usedAt: NOW }]);
  });

  it('유효 시간 경계의 키는 소모하고 경계를 넘은 키는 소모하지 않는다', async () => {
    await seed({ id: 'key-1', issuedAt: new Date(NOW.getTime() - TTL_MS) });
    await seed({ id: 'key-2', issuedAt: new Date(NOW.getTime() - TTL_MS - 1) });

    expect(await consume({ key: 'key-1' })).not.toBeNull();
    expect(await consume({ key: 'key-2' })).toBeNull();
  });

  it.each<[string, { userId?: string; usedAt?: Date; stageCode?: string }]>([
    ['다른 사용자의 키', { userId: 'user-b' }],
    ['사용한 키', { usedAt: new Date(NOW.getTime() - 1000) }],
    ['판 코드 조건에 맞지 않는 키', { stageCode: 'e-10000-0' }],
  ])('%s는 소모하지 않고 null을 반환한다', async (_label, override) => {
    await seed({ id: 'key-1', ...override });

    expect(await consume()).toBeNull();
    expect(await store.query(`select "usedAt" from "Attempt"`)).toEqual([{ usedAt: override.usedAt ?? null }]);
  });

  it('없는 키는 null을 반환한다', async () => {
    expect(await consume({ key: 'missing' })).toBeNull();
  });

  it('지정한 판 코드와 다른 키는 소모하지 않는다', async () => {
    await seed({ id: 'key-1', stageCode: 'e-10000-0' });
    expect(await consume({ stageCodePattern: undefined, stageCode: 'e-10000-1' })).toBeNull();
    expect(await consume({ stageCodePattern: undefined, stageCode: 'e-10000-0' })).toMatchObject({ stageCode: 'e-10000-0' });
  });

  it('같은 키를 동시에 소모하면 한 요청만 성공한다', async () => {
    await seed({ id: 'key-1' });
    const results = await Promise.all([consume(), consume(), consume()]);
    expect(results.filter((r) => r !== null)).toHaveLength(1);
  });

  it('소모를 되돌리면 같은 키를 다시 소모할 수 있다', async () => {
    await seed({ id: 'key-1' });
    await consume();

    await releaseAttempt(store.db, { key: 'key-1', userId: 'user-a' });

    expect(await store.query(`select "usedAt" from "Attempt"`)).toEqual([{ usedAt: null }]);
    expect(await consume()).not.toBeNull();
  });
});

describe('attempt store 시간대', () => {
  it('프로세스 시간대와 무관하게 유효 시간을 판정하고 UTC 시각으로 소모를 기록한다', async () => {
    await seed({ id: 'key-1', issuedAt: new Date(NOW.getTime() - TTL_MS) });
    const original = process.env.TZ;
    process.env.TZ = 'Asia/Seoul';
    try {
      expect(await consume()).not.toBeNull();
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
    expect(await store.query(`select to_char("usedAt", 'YYYY-MM-DD HH24:MI') as at from "Attempt"`)).toEqual([
      { at: '2026-10-21 03:00' },
    ]);
  });
});

describe('attempt store 무한모드 판 조건', () => {
  it('무한모드 판이 있는 키만 소모한다', async () => {
    await store.query(`insert into "EndlessStage" (id, size, regions, solution, tier, seed) values ('e-1-0', 7, 'r', 's', 1, 1)`);
    await seed({ id: 'key-1', stageCode: 'e-1-0' });
    await seed({ id: 'key-2', stageCode: 'e-9-9' });
    await seed({ id: 'key-3', stageCode: '1-1' });

    const consumeEndless = (key: string) =>
      consume({ key, stageCodePattern: undefined, requireEndlessStage: true });

    expect(await consumeEndless('key-2')).toBeNull();
    expect(await consumeEndless('key-3')).toBeNull();
    expect(await consumeEndless('key-1')).toMatchObject({ stageCode: 'e-1-0' });
    expect(await store.query(`select id from "Attempt" where "usedAt" is not null`)).toEqual([{ id: 'key-1' }]);
  });
});

describe('attempt store 발급 시각', () => {
  it('발급 시각을 애플리케이션 시각으로 기록한다', async () => {
    const issuedAt = new Date('2030-01-01T00:00:00.000Z');
    const issued = await issueAttempt(store.db, { userId: 'user-a', stageCode: '1-1', issuedAt });
    expect(await store.query(`select "issuedAt" from "Attempt" where id = $1`, [issued.id])).toEqual([{ issuedAt }]);
  });
});
