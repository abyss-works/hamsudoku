import { beforeAll, describe, expect, it, vi } from 'vitest';
import { callRoute, seedUser, signInAs, useRouteDatabase } from '../../../../../tools/dbTest/routeHarness';

vi.mock('next/server', async (original) =>
  (await import('../../../../../tools/dbTest/routeHarness')).mockNextServer(await original()),
);
vi.mock('../../../../server/auth', async (original) =>
  (await import('../../../../../tools/dbTest/routeHarness')).mockAuth(await original()),
);

const db = useRouteDatabase();
let POST: (req: Request) => Promise<Response>;

beforeAll(async () => {
  ({ POST } = await import('./route'));
});

function save(body: unknown) {
  return callRoute(POST, { path: '/api/profile/nickname', body });
}

describe('POST /api/profile/nickname', () => {
  it('세션이 없으면 401을 반환한다', async () => {
    expect(await save({ nickname: '햄스터' })).toEqual({ status: 401, body: { ok: false, msg: '로그인이 필요해요.' } });
  });

  it('요청 형식이 틀리면 400을 반환한다', async () => {
    await seedUser(db, 'user-a');
    signInAs('user-a');
    expect(await save({ nickname: 3 })).toEqual({ status: 400, body: { ok: false, msg: '요청을 확인하세요.' } });
  });

  it.each([
    ['   ', '닉네임을 입력하세요.'],
    ['a', '닉네임은 2~12자로 입력하세요.'],
    ['열세글자를넘는아주긴닉네임', '닉네임은 2~12자로 입력하세요.'],
  ])('규칙에 맞지 않는 닉네임 %j는 400과 안내 문구를 반환한다', async (nickname, msg) => {
    await seedUser(db, 'user-a', '원래이름');
    signInAs('user-a');
    expect(await save({ nickname })).toEqual({ status: 400, body: { ok: false, msg } });
    expect(await db.query(`select nickname from "Profile" where "userId" = 'user-a'`)).toEqual([{ nickname: '원래이름' }]);
  });

  it('앞뒤 공백을 제거한 닉네임을 저장하고 반환한다', async () => {
    await seedUser(db, 'user-a', '원래이름');
    await seedUser(db, 'user-b', '원래이름');
    signInAs('user-a');

    const res = await save({ nickname: '  햄스터  ' });

    expect(res).toEqual({ status: 200, body: { ok: true, nickname: '햄스터' } });
    expect(await db.query(`select "userId", nickname from "Profile" order by "userId"`)).toEqual([
      { userId: 'user-a', nickname: '햄스터' },
      { userId: 'user-b', nickname: '원래이름' },
    ]);
  });
});
