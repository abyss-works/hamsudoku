import { beforeAll, describe, expect, it, vi } from 'vitest';
import { callRoute, seedUser, signInAs, useRouteDatabase } from '../../../../tools/dbTest/routeHarness';

vi.mock('next/server', async (original) =>
  (await import('../../../../tools/dbTest/routeHarness')).mockNextServer(await original()),
);
vi.mock('../../../server/auth', async (original) =>
  (await import('../../../../tools/dbTest/routeHarness')).mockAuth(await original()),
);

const db = useRouteDatabase();
let POST: (req: Request) => Promise<Response>;

beforeAll(async () => {
  ({ POST } = await import('./route'));
});

function issue(body: unknown) {
  return callRoute(POST, { path: '/api/attempts', body });
}

describe('POST /api/attempts', () => {
  it('세션이 없으면 401을 반환한다', async () => {
    expect(await issue({ stageCode: '1-1' })).toEqual({ status: 401, body: { ok: false, msg: '로그인이 필요해요.' } });
  });

  it.each([[{}], [{ stageCode: '' }], [{ stageCode: 'e-10000-0' }], [{ stageCode: '6-1' }]])(
    '스테이지 코드가 아니면 400을 반환한다 (%j)',
    async (body) => {
      await seedUser(db, 'user-a');
      signInAs('user-a');
      expect(await issue(body)).toEqual({ status: 400, body: { ok: false, msg: '스테이지 코드를 확인하세요.' } });
      expect(await db.query(`select 1 from "Attempt"`)).toHaveLength(0);
    },
  );

  it('스테이지 입장 키를 발급하고 미사용 상태로 저장한다', async () => {
    await seedUser(db, 'user-a');
    signInAs('user-a');

    const res = await issue({ stageCode: '3-10' });

    expect(res.status).toBe(200);
    const key = (res.body as { attemptKey: string }).attemptKey;
    expect(key).toEqual(expect.any(String));
    expect(await db.query(`select id, "userId", "stageCode", "usedAt", "issuedAt" is not null as issued from "Attempt"`)).toEqual([
      { id: key, userId: 'user-a', stageCode: '3-10', usedAt: null, issued: true },
    ]);
  });
});
