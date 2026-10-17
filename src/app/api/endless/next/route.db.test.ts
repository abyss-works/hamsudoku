import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ACTIVE_NOW,
  STAGE_SOLUTION,
  callRoute,
  outbound,
  secondsBefore,
  seedAttempt,
  seedStage,
  seedUser,
  sentryLogs,
  signInAs,
  useRouteDatabase,
} from '../../../../../tools/dbTest/routeHarness';

vi.mock('@sentry/nextjs', async () => (await import('../../../../../tools/dbTest/routeHarness')).mockSentry());
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

const USER = 'user-a';
const subtle = globalThis.crypto.subtle;
const HKDF_INFO = 'hamsudoku:endless:solution:v1';

async function clientKeys() {
  const pair = (await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])) as CryptoKeyPair;
  const publicKey = Buffer.from(await subtle.exportKey('raw', pair.publicKey)).toString('base64');
  return { pair, publicKey };
}

async function decrypt(pair: CryptoKeyPair, payload: { serverPublicKey: string; iv: string; solutionCipher: string }) {
  const serverKey = await subtle.importKey(
    'raw',
    Buffer.from(payload.serverPublicKey, 'base64'),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const shared = await subtle.deriveBits({ name: 'ECDH', public: serverKey }, pair.privateKey, 256);
  const hkdf = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  const aes = await subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: new TextEncoder().encode(HKDF_INFO) },
    hkdf,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const plain = await subtle.decrypt(
    { name: 'AES-GCM', iv: Buffer.from(payload.iv, 'base64') },
    aes,
    Buffer.from(payload.solutionCipher, 'base64'),
  );
  return new TextDecoder().decode(plain);
}

type NextBody = {
  stage: { id: string; size: number; regions: string };
  solutionCipher: string;
  serverPublicKey: string;
  iv: string;
  attemptKey: string;
};

async function next(stageId?: string) {
  const keys = await clientKeys();
  const body = stageId === undefined ? { clientPublicKey: keys.publicKey } : { clientPublicKey: keys.publicKey, stageId };
  const res = await callRoute<NextBody>(POST, { path: '/api/endless/next', body });
  return { ...res, keys };
}

/**
 * 판을 발급받고 공급 판정이 오류 없이 끝났는지 확인한다. 응답 후 공급 판정은 실패를 로그로만 남기므로
 * 작업·발행이 없다는 단언만으로는 판정 실패와 구분되지 않는다.
 */
async function nextWithQuietSupply() {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const res = await next();
    expect(res.status).toBe(200);
    expect(errors).not.toHaveBeenCalled();
    expect(warnings).not.toHaveBeenCalled();
    return res;
  } finally {
    errors.mockRestore();
    warnings.mockRestore();
  }
}

/** 공급 판정이 재고 충분으로 끝나도록 클리어 수 0인 판을 채운다. */
async function seedStock(count: number, firstSeed = 20000) {
  for (let i = 0; i < count; i += 1) await seedStage(db, { id: `e-${firstSeed + i}-0`, seed: firstSeed + i });
}

describe('POST /api/endless/next', () => {
  it('세션이 없으면 401을 반환한다', async () => {
    expect((await next()).status).toBe(401);
  });

  it('요청 형식이 틀리면 400을 반환한다', async () => {
    signInAs(USER);
    expect(await callRoute(POST, { path: '/api/endless/next', body: {} })).toEqual({
      status: 400,
      body: { ok: false, msg: '요청이 올바르지 않아요.' },
    });
  });

  it('남은 판이 없으면 503을 반환한다', async () => {
    await seedUser(db, USER);
    signInAs(USER);
    const res = await next();
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false, msg: '새 판을 준비 중이에요.' });
    expect(sentryLogs).toContainEqual({ level: 'warn', message: 'Endless pool empty', attributes: {} });
  });

  it('씨앗 3개로 클리어하지 않은 판과 입장 키를 발급하고 정답을 암호화해 전달한다', async () => {
    await seedUser(db, USER);
    await seedStock(20);
    await seedStage(db, { id: 'e-10000-0', regions: '0123456'.repeat(7), clears: 3 });
    await db.query(
      `insert into "EndlessProgress" ("userId", "stageId", cleared, attempts, "bestSeedLeft", "lastPlayedAt")
       select $1, id, true, 1, 3, $2 from "EndlessStage" where id <> 'e-10000-0'`,
      [USER, ACTIVE_NOW],
    );
    signInAs(USER);

    const res = await next();

    expect(res.status).toBe(200);
    expect(res.body.stage).toEqual({ id: 'e-10000-0', size: 7, regions: '0123456'.repeat(7) });
    expect(await decrypt(res.keys.pair, res.body)).toBe(STAGE_SOLUTION);
    expect(await db.query(`select id, "userId", "stageCode", "usedAt" from "Attempt"`)).toEqual([
      { id: res.body.attemptKey, userId: USER, stageCode: 'e-10000-0', usedAt: null },
    ]);
  });

  it('씨앗 3개로 클리어한 판은 고르지 않는다', async () => {
    await seedUser(db, USER);
    await seedStock(20);
    await db.query(
      `insert into "EndlessProgress" ("userId", "stageId", cleared, attempts, "bestSeedLeft", "lastPlayedAt")
       select $1, id, id <> 'e-20005-0', 1, case when id <> 'e-20005-0' then 3 else 0 end, $2 from "EndlessStage"`,
      [USER, ACTIVE_NOW],
    );
    signInAs(USER);

    for (let i = 0; i < 3; i += 1) expect((await next()).body.stage.id).toBe('e-20005-0');
  });

  it('씨앗을 잃고 클리어한 판은 다시 고를 수 있다', async () => {
    await seedUser(db, USER);
    await seedStock(20);
    await db.query(
      `insert into "EndlessProgress" ("userId", "stageId", cleared, attempts, "bestSeedLeft", "lastPlayedAt")
       select $1, id, true, 1, case when id = 'e-20007-0' then 2 else 3 end, $2 from "EndlessStage"`,
      [USER, ACTIVE_NOW],
    );
    signInAs(USER);

    expect((await next()).body.stage.id).toBe('e-20007-0');
  });

  it('입장 키를 받은 적 있는 판을 지정하면 씨앗 3개로 클리어한 판이어도 그 판의 새 입장 키를 발급한다', async () => {
    await seedUser(db, USER);
    await seedStock(20);
    await seedStage(db, { id: 'e-10000-0', regions: '0123456'.repeat(7), clears: 3 });
    await seedAttempt(db, { id: 'old-key', userId: USER, stageCode: 'e-10000-0', issuedAt: secondsBefore(ACTIVE_NOW, 600) });
    await db.query(
      `insert into "EndlessProgress" ("userId", "stageId", cleared, attempts, "bestSeedLeft", "lastPlayedAt") values ($1, 'e-10000-0', true, 1, 3, $2)`,
      [USER, ACTIVE_NOW],
    );
    signInAs(USER);

    const res = await next('e-10000-0');

    expect(res.status).toBe(200);
    expect(res.body.stage).toEqual({ id: 'e-10000-0', size: 7, regions: '0123456'.repeat(7) });
    expect(await decrypt(res.keys.pair, res.body)).toBe(STAGE_SOLUTION);
    expect(res.body.attemptKey).not.toBe('old-key');
    expect(await db.query(`select "stageCode", "usedAt" from "Attempt" where id = $1`, [res.body.attemptKey])).toEqual([
      { stageCode: 'e-10000-0', usedAt: null },
    ]);
  });

  it('입장 키를 받은 적 없는 판을 지정하면 거절하고 입장 키를 발급하지 않는다', async () => {
    await seedUser(db, USER);
    await seedStock(20);
    await seedAttempt(db, { id: 'other-key', userId: 'user-b', stageCode: 'e-20000-0', issuedAt: secondsBefore(ACTIVE_NOW, 600) });
    signInAs(USER);

    for (const stageId of ['e-20000-0', 'e-missing-0']) {
      const res = await next(stageId);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ ok: false, msg: '다시 도전할 수 없는 판이에요.' });
    }
    expect(await db.query(`select id from "Attempt" where "userId" = $1`, [USER])).toEqual([]);
  });

  it('재고가 충분하면 공급 작업을 만들지 않는다', async () => {
    await seedUser(db, USER);
    await seedStock(20);
    signInAs(USER);

    await nextWithQuietSupply();

    expect(await db.query(`select 1 from "EndlessSupplyJob"`)).toHaveLength(0);
    expect(outbound.requests).toHaveLength(0);
  });

  it('재고가 부족하면 다음 시드 구간의 공급 작업을 만들고 생성 요청을 발행한다', async () => {
    await seedUser(db, USER);
    await seedStock(19);
    signInAs(USER);

    const res = await next();

    expect(res.status).toBe(200);
    const jobs = await db.query<{ id: string }>(
      `select id, "policyVersion", "seedStart", "seedEnd", "targetCount", status, "leaseExpiresAt" from "EndlessSupplyJob"`,
    );
    expect(jobs).toEqual([
      {
        id: expect.any(String),
        policyVersion: 'v1',
        seedStart: 20018,
        seedEnd: 20028,
        targetCount: 10,
        status: 'pending',
        leaseExpiresAt: new Date(ACTIVE_NOW.getTime() + 120_000),
      },
    ]);
    const jobId = jobs[0].id;
    expect(await db.query(`select id, "jobId", "chunkIndex", status, "stageCount" from "EndlessSupplyChunk"`)).toEqual([
      { id: `${jobId}:0`, jobId, chunkIndex: 0, status: 'pending', stageCount: 0 },
    ]);
    expect(outbound.requests).toEqual([
      expect.objectContaining({
        url: 'http://qstash.test/v2/publish/http://app.test/api/internal/endless-generate',
        method: 'POST',
        body: { jobId, chunkIndex: 0 },
      }),
    ]);
    expect(outbound.requests[0].headers).toMatchObject({
      authorization: 'Bearer test-qstash-token',
      'upstash-retries': '3',
    });
  });

  it('생성 요청 발행이 실패하면 작업을 발행 실패로 기록하고 판은 정상 발급한다', async () => {
    await seedUser(db, USER);
    await seedStock(5);
    outbound.status = 500;
    signInAs(USER);

    const res = await next();

    expect(res.status).toBe(200);
    expect(await db.query(`select status, "leaseExpiresAt" from "EndlessSupplyJob"`)).toEqual([
      { status: 'publish_failed', leaseExpiresAt: null },
    ]);
    expect(await db.query(`select status from "EndlessSupplyChunk"`)).toEqual([{ status: 'publish_failed' }]);
  });

  it('진행 중인 공급 작업이 있으면 새 작업을 만들지 않는다', async () => {
    await seedUser(db, USER);
    await seedStock(5);
    await db.query(
      `insert into "EndlessSupplyJob" (id, "policyVersion", "seedStart", "seedEnd", "targetCount", status, "leaseExpiresAt", "updatedAt")
       values ('job-active', 'v1', 30000, 30010, 10, 'running', $1, $2)`,
      [new Date(ACTIVE_NOW.getTime() + 60_000), ACTIVE_NOW],
    );
    signInAs(USER);

    await nextWithQuietSupply();

    expect(await db.query(`select id from "EndlessSupplyJob"`)).toEqual([{ id: 'job-active' }]);
    expect(outbound.requests).toHaveLength(0);
  });

  it('임대가 만료된 작업은 실패로 바꾸고 새 작업을 만든다', async () => {
    await seedUser(db, USER);
    await seedStock(5);
    await db.query(
      `insert into "EndlessSupplyJob" (id, "policyVersion", "seedStart", "seedEnd", "targetCount", status, "leaseExpiresAt", "updatedAt")
       values ('job-expired', 'v1', 30000, 30010, 10, 'running', $1, $1)`,
      [secondsBefore(ACTIVE_NOW, 1)],
    );
    signInAs(USER);

    await nextWithQuietSupply();

    const jobs = await db.query<{ id: string; status: string; seedStart: number }>(
      `select id, status, "seedStart" from "EndlessSupplyJob" order by "seedStart"`,
    );
    expect(jobs).toEqual([
      { id: 'job-expired', status: 'failed', seedStart: 30000 },
      { id: expect.any(String), status: 'pending', seedStart: 30010 },
    ]);
  });

  it('최근 공급 성공 후 60초 안에는 새 작업을 만들지 않는다', async () => {
    await seedUser(db, USER);
    await seedStock(5);
    await db.query(
      `insert into "EndlessSupplyJob" (id, "policyVersion", "seedStart", "seedEnd", "targetCount", status, "lastSuccessAt", "updatedAt")
       values ('job-done', 'v1', 30000, 30010, 10, 'completed', $1, $1)`,
      [secondsBefore(ACTIVE_NOW, 59)],
    );
    signInAs(USER);

    await nextWithQuietSupply();

    expect(await db.query(`select id from "EndlessSupplyJob"`)).toEqual([{ id: 'job-done' }]);
    expect(outbound.requests).toHaveLength(0);
  });
});
