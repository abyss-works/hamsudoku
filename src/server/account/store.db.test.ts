import { describe, expect, it } from 'vitest';
import { useStoreDatabase } from '../../../tools/dbTest/storeHarness';
import { findNickname, findNicknames } from './queries';
import { saveNickname, upsertAccount } from './store';

const store = useStoreDatabase();

const AT = new Date('2026-10-21T03:00:00.000Z');
const LATER = new Date('2026-10-21T04:00:00.000Z');

describe('account store', () => {
  it('계정 기록은 사용자와 프로필 행을 만든다', async () => {
    await upsertAccount(store.db, { userId: 'user-a', email: 'a@example.com', at: AT });

    expect(await store.query(`select id, email from "User"`)).toEqual([{ id: 'user-a', email: 'a@example.com' }]);
    expect(await store.query(`select "userId", nickname, "updatedAt" from "Profile"`)).toEqual([
      { userId: 'user-a', nickname: null, updatedAt: AT },
    ]);
  });

  it('이메일이 없으면 기존 이메일과 프로필을 유지한다', async () => {
    await upsertAccount(store.db, { userId: 'user-a', email: 'a@example.com', at: AT });
    await saveNickname(store.db, { userId: 'user-a', nickname: '햄스터', at: AT });

    await upsertAccount(store.db, { userId: 'user-a', email: null, at: LATER });

    expect(await store.query(`select id, email from "User"`)).toEqual([{ id: 'user-a', email: 'a@example.com' }]);
    expect(await store.query(`select nickname, "updatedAt" from "Profile"`)).toEqual([{ nickname: '햄스터', updatedAt: AT }]);
  });

  it('새 이메일은 기존 이메일을 갱신한다', async () => {
    await upsertAccount(store.db, { userId: 'user-a', email: null, at: AT });
    await upsertAccount(store.db, { userId: 'user-a', email: 'a@example.com', at: LATER });
    expect(await store.query(`select email from "User"`)).toEqual([{ email: 'a@example.com' }]);
  });

  it('동시 계정 기록은 충돌 없이 한 행으로 모인다', async () => {
    await Promise.all([
      upsertAccount(store.db, { userId: 'user-a', email: null, at: AT }),
      upsertAccount(store.db, { userId: 'user-a', email: 'a@example.com', at: AT }),
      upsertAccount(store.db, { userId: 'user-a', email: null, at: AT }),
    ]);
    expect(await store.query(`select id, email from "User"`)).toEqual([{ id: 'user-a', email: 'a@example.com' }]);
    expect(await store.query(`select count(*)::int as n from "Profile"`)).toEqual([{ n: 1 }]);
  });

  it('닉네임 저장은 프로필이 없으면 만들고 있으면 갱신 시각과 함께 바꾼다', async () => {
    await saveNickname(store.db, { userId: 'user-a', nickname: '햄스터', at: AT });
    await saveNickname(store.db, { userId: 'user-a', nickname: '다람쥐', at: LATER });

    expect(await store.query(`select "userId", nickname, "updatedAt" from "Profile"`)).toEqual([
      { userId: 'user-a', nickname: '다람쥐', updatedAt: LATER },
    ]);
  });

  it('닉네임 조회는 없으면 null을 반환한다', async () => {
    await saveNickname(store.db, { userId: 'user-a', nickname: '햄스터', at: AT });
    await upsertAccount(store.db, { userId: 'user-b', email: null, at: AT });

    expect(await findNickname(store.db, 'user-a')).toBe('햄스터');
    expect(await findNickname(store.db, 'user-b')).toBeNull();
    expect(await findNickname(store.db, 'user-z')).toBeNull();
  });

  it('닉네임 일괄 조회는 요청한 사용자마다 값 또는 null을 돌려준다', async () => {
    await saveNickname(store.db, { userId: 'user-a', nickname: '햄스터', at: AT });
    await upsertAccount(store.db, { userId: 'user-b', email: null, at: AT });

    expect(await findNicknames(store.db, ['user-a', 'user-b', 'user-z'])).toEqual({
      'user-a': '햄스터',
      'user-b': null,
      'user-z': null,
    });
    expect(await findNicknames(store.db, [])).toEqual({});
  });
});

describe('account store 시간대', () => {
  it('프로세스 시간대와 무관하게 UTC 시각으로 저장한다', async () => {
    const original = process.env.TZ;
    process.env.TZ = 'Asia/Seoul';
    try {
      await upsertAccount(store.db, { userId: 'user-a', email: null, at: AT });
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
    expect(await store.query(`select to_char("updatedAt", 'YYYY-MM-DD HH24:MI') as at from "Profile"`)).toEqual([
      { at: '2026-10-21 03:00' },
    ]);
  });
});

describe('account store 불필요한 갱신', () => {
  it('값이 바뀌지 않는 계정 기록은 사용자 행을 다시 쓰지 않는다', async () => {
    await upsertAccount(store.db, { userId: 'user-a', email: 'a@example.com', at: AT });
    const [before] = await store.query<{ xmin: string }>(`select xmin::text from "User" where id = 'user-a'`);

    await upsertAccount(store.db, { userId: 'user-a', email: null, at: LATER });
    await upsertAccount(store.db, { userId: 'user-a', email: 'a@example.com', at: LATER });

    const [after] = await store.query<{ xmin: string }>(`select xmin::text from "User" where id = 'user-a'`);
    expect(after.xmin).toBe(before.xmin);
  });
});
