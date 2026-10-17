import { describe, expect, it } from 'vitest';
import { useStoreDatabase } from '../../../tools/dbTest/storeHarness';
import { listStageRecords } from './queries';
import { recordUnverifiedClear, recordVerifiedClear } from './store';

const store = useStoreDatabase();

const AT = new Date('2026-10-21T03:00:00.000Z');
const EARLIER = new Date('2026-10-20T03:00:00.000Z');

async function seedRecord(record: { userId?: string; stageCode?: string; best: number | null; attempts: number; at: Date }) {
  await store.query(
    `insert into "ClearRecord" ("userId", "stageCode", "bestElapsedSec", attempts, "lastClearedAt", "updatedAt") values ($1, $2, $3, $4, $5, $5)`,
    [record.userId ?? 'user-a', record.stageCode ?? '2-5', record.best, record.attempts, record.at],
  );
}

describe('stageRecord store', () => {
  it('첫 검증 클리어는 요약 기록과 검증 이벤트를 함께 만들고 최고 기록을 반환한다', async () => {
    const result = await recordVerifiedClear(store.db, { userId: 'user-a', stageCode: '2-5', elapsedSec: 95, at: AT });

    expect(result).toEqual({ bestElapsedSec: 95 });
    expect(
      await store.query(`select "userId", "stageCode", "bestElapsedSec", attempts, "lastClearedAt", "updatedAt" from "ClearRecord"`),
    ).toEqual([{ userId: 'user-a', stageCode: '2-5', bestElapsedSec: 95, attempts: 1, lastClearedAt: AT, updatedAt: AT }]);
    expect(await store.query(`select "userId", "stageCode", "elapsedSec", verified, "clearedAt" from "ClearEvent"`)).toEqual([
      { userId: 'user-a', stageCode: '2-5', elapsedSec: 95, verified: true, clearedAt: AT },
    ]);
  });

  it('기존 기록에는 더 짧은 기록과 더 늦은 시각만 반영하고 횟수를 늘린다', async () => {
    await seedRecord({ best: 60, attempts: 3, at: EARLIER });

    expect(await recordVerifiedClear(store.db, { userId: 'user-a', stageCode: '2-5', elapsedSec: 95, at: AT })).toEqual({
      bestElapsedSec: 60,
    });
    expect(await recordVerifiedClear(store.db, { userId: 'user-a', stageCode: '2-5', elapsedSec: 40, at: EARLIER })).toEqual({
      bestElapsedSec: 40,
    });
    expect(await store.query(`select "bestElapsedSec", attempts, "lastClearedAt", "updatedAt" from "ClearRecord"`)).toEqual([
      { bestElapsedSec: 40, attempts: 5, lastClearedAt: AT, updatedAt: EARLIER },
    ]);
  });

  it('경과 시간 0초는 최고 기록으로 쓰지 않는다', async () => {
    expect(await recordVerifiedClear(store.db, { userId: 'user-a', stageCode: '2-5', elapsedSec: 0, at: AT })).toEqual({
      bestElapsedSec: null,
    });
    await recordVerifiedClear(store.db, { userId: 'user-a', stageCode: '2-5', elapsedSec: 30, at: AT });
    expect(await recordVerifiedClear(store.db, { userId: 'user-a', stageCode: '2-5', elapsedSec: 0, at: AT })).toEqual({
      bestElapsedSec: 30,
    });
    expect(await store.query(`select "elapsedSec" from "ClearEvent" order by "elapsedSec"`)).toEqual([
      { elapsedSec: 0 },
      { elapsedSec: 0 },
      { elapsedSec: 30 },
    ]);
  });

  it('미검증 클리어는 이벤트만 남긴다', async () => {
    await recordUnverifiedClear(store.db, { userId: 'user-a', stageCode: '4-2', elapsedSec: 42, at: AT });

    expect(await store.query(`select "userId", "stageCode", "elapsedSec", verified, "clearedAt" from "ClearEvent"`)).toEqual([
      { userId: 'user-a', stageCode: '4-2', elapsedSec: 42, verified: false, clearedAt: AT },
    ]);
    expect(await store.query(`select 1 from "ClearRecord"`)).toHaveLength(0);
  });

  it('요약 기록 조회는 본인 기록만 판 코드 순서로 반환한다', async () => {
    await seedRecord({ stageCode: '1-2', best: null, attempts: 1, at: AT });
    await seedRecord({ stageCode: '1-1', best: 30, attempts: 2, at: EARLIER });
    await seedRecord({ userId: 'user-b', stageCode: '1-1', best: 10, attempts: 1, at: AT });

    expect(await listStageRecords(store.db, 'user-a')).toEqual([
      { stageCode: '1-1', bestElapsedSec: 30, attempts: 2, lastClearedAt: EARLIER.toISOString() },
      { stageCode: '1-2', bestElapsedSec: null, attempts: 1, lastClearedAt: AT.toISOString() },
    ]);
  });
});

describe('stageRecord store 시간대', () => {
  it('프로세스 시간대와 무관하게 UTC 시각으로 저장한다', async () => {
    const original = process.env.TZ;
    process.env.TZ = 'Asia/Seoul';
    try {
      await recordVerifiedClear(store.db, { userId: 'user-a', stageCode: '2-5', elapsedSec: 95, at: AT });
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
    expect(await store.query(`select to_char("lastClearedAt", 'YYYY-MM-DD HH24:MI') as at from "ClearRecord"`)).toEqual([
      { at: '2026-10-21 03:00' },
    ]);
  });
});
