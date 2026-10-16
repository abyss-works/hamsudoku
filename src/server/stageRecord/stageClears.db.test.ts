import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ACTIVE_NOW, secondsBefore, seedAttempt, useRouteDatabase } from '../../../tools/dbTest/routeHarness';

const failure = vi.hoisted(() => ({ next: false }));

vi.mock('./store', async (original) => {
  const actual = await original<typeof import('./store')>();
  return {
    ...actual,
    recordVerifiedClear: async (...args: Parameters<typeof actual.recordVerifiedClear>) => {
      if (failure.next) {
        failure.next = false;
        throw new Error('record failed');
      }
      return actual.recordVerifiedClear(...args);
    },
  };
});

const db = useRouteDatabase();
let submitStageClear: typeof import('./stageClears').submitStageClear;

beforeAll(async () => {
  ({ submitStageClear } = await import('./stageClears'));
});

describe('submitStageClear', () => {
  it('기록 저장이 실패하면 키 소모를 되돌려 같은 키로 다시 제출할 수 있다', async () => {
    await seedAttempt(db, { id: 'key-1', userId: 'user-a', stageCode: '2-5', issuedAt: secondsBefore(ACTIVE_NOW, 30) });
    failure.next = true;

    await expect(
      submitStageClear('user-a', { attemptKey: 'key-1', elapsedSec: 3 }, ACTIVE_NOW.toISOString()),
    ).rejects.toThrow('record failed');
    expect(await db.query(`select "usedAt" from "Attempt"`)).toEqual([{ usedAt: null }]);

    expect(await submitStageClear('user-a', { attemptKey: 'key-1', elapsedSec: 3 }, ACTIVE_NOW.toISOString())).toEqual({
      status: 200,
      bestElapsedSec: 30,
    });
  });
});
