// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as getRankRoute } from '../../endless/rank/route';
import { createMemoryDb } from '../../../../server/db/memory';
import type { DbPort } from '../../../../server/db/port';
import { createTestQStashSignature } from '../../../../server/qstashTestHelper';
import { POST } from './route';

const TEST_SECRET = 'test_internal_secret_value';
const TEST_KEY = 'test_qstash_signing_key';

let testDb: DbPort;

vi.mock('../../../../server/db/prisma', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../server/db/prisma')>();
  return {
    ...actual,
    createPrismaDb: () => testDb,
  };
});

vi.mock('../../../../server/auth', () => ({
  getSessionUser: vi.fn(async () => ({ uid: 'user_tester', email: null })),
}));

describe('/api/internal/ranking-finalize 및 자동 확정/복구', () => {
  beforeEach(() => {
    testDb = createMemoryDb();
    process.env.INTERNAL_SECRET = TEST_SECRET;
    process.env.QSTASH_CURRENT_SIGNING_KEY = TEST_KEY;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env.INTERNAL_SECRET;
    delete process.env.QSTASH_CURRENT_SIGNING_KEY;
  });

  it('잘못된 인증 요청은 401을 반환한다', async () => {
    // 1. 인증 헤더 누락
    const reqNoAuth = new Request('http://localhost/api/internal/ranking-finalize', {
      method: 'POST',
      body: JSON.stringify({ season: '2026-W41' }),
    });
    const resNoAuth = await POST(reqNoAuth);
    expect(resNoAuth.status).toBe(401);

    // 2. 잘못된 Bearer 토큰
    const reqBadBearer = new Request('http://localhost/api/internal/ranking-finalize', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong_token' },
      body: JSON.stringify({ season: '2026-W41' }),
    });
    const resBadBearer = await POST(reqBadBearer);
    expect(resBadBearer.status).toBe(401);

    // 3. 잘못된 서명 키로 서명된 QStash 요청
    const badSig = createTestQStashSignature(
      { iss: 'Upstash', exp: Math.floor(Date.now() / 1000) + 300 },
      'wrong_key',
    );
    const reqBadSig = new Request('http://localhost/api/internal/ranking-finalize', {
      method: 'POST',
      headers: { 'upstash-signature': badSig },
      body: JSON.stringify({ season: '2026-W41' }),
    });
    const resBadSig = await POST(reqBadSig);
    expect(resBadSig.status).toBe(401);
  });

  it('zod 요청 검증: null, 배열, 숫자, 유효하지 않은 season은 500이 아닌 400을 반환한다', async () => {
    // 1. 배열 본문
    const reqArray = new Request('http://localhost/api/internal/ranking-finalize', {
      method: 'POST',
      headers: { authorization: `Bearer ${TEST_SECRET}` },
      body: JSON.stringify([1, 2, 3]),
    });
    const resArray = await POST(reqArray);
    expect(resArray.status).toBe(400);

    // 2. 숫자 본문
    const reqNum = new Request('http://localhost/api/internal/ranking-finalize', {
      method: 'POST',
      headers: { authorization: `Bearer ${TEST_SECRET}` },
      body: '12345',
    });
    const resNum = await POST(reqNum);
    expect(resNum.status).toBe(400);

    // 3. null 본문
    const reqNull = new Request('http://localhost/api/internal/ranking-finalize', {
      method: 'POST',
      headers: { authorization: `Bearer ${TEST_SECRET}` },
      body: 'null',
    });
    const resNull = await POST(reqNull);
    expect(resNull.status).toBe(400);

    // 4. 잘못된 형식의 season
    const reqBadSeason = new Request('http://localhost/api/internal/ranking-finalize', {
      method: 'POST',
      headers: { authorization: `Bearer ${TEST_SECRET}` },
      body: JSON.stringify({ season: 'invalid-season-format' }),
    });
    const resBadSeason = await POST(reqBadSeason);
    expect(resBadSeason.status).toBe(400);
  });


  it('정상 확정 후 재전달(재시도) 시 멱등하게 동일 결과를 반환한다', async () => {
    // 2026-W41 (2026-10-05 04:00 KST ~ 2026-10-12 00:00 KST)
    // 2026-10-05 04:00 KST = 2026-10-04 19:00:00 UTC
    // 2026-10-12 00:00 KST = 2026-10-11 15:00:00 UTC
    await testDb.commitEndlessClear('user_1', 'stage_1', {
      earned: 100,
      season: '2026-W41',
      seedLeft: 10,
      elapsedMs: 20000,
      suspicious: false,
      atIso: '2026-10-06T10:00:00Z',
    });
    await testDb.commitEndlessClear('user_2', 'stage_1', {
      earned: 200,
      season: '2026-W41',
      seedLeft: 10,
      elapsedMs: 20000,
      suspicious: false,
      atIso: '2026-10-07T10:00:00Z',
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T16:00:00Z')); // 2026-10-12 01:00 KST (시즌 종료 후)

    const payload = JSON.stringify({ season: '2026-W41' });
    const sig = createTestQStashSignature(
      { iss: 'Upstash', exp: Math.floor(Date.now() / 1000) + 300 },
      TEST_KEY,
      payload,
    );

    // 1회차 호출
    const req1 = new Request('http://localhost/api/internal/ranking-finalize', {
      method: 'POST',
      headers: { 'upstash-signature': sig },
      body: payload,
    });
    const res1 = await POST(req1);
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.ok).toBe(true);
    expect(body1.results).toHaveLength(2);
    expect(body1.results[0].userId).toBe('user_2');
    expect(body1.results[0].rank).toBe(1);
    expect(body1.results[1].userId).toBe('user_1');
    expect(body1.results[1].rank).toBe(2);

    // 2회차 호출 (재전달/재시도)
    const req2 = new Request('http://localhost/api/internal/ranking-finalize', {
      method: 'POST',
      headers: { 'upstash-signature': sig },
      body: payload,
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.ok).toBe(true);
    expect(body2.results).toEqual(body1.results);
  });

  it('스케줄 지연으로 늦게 실행되어도 집계 구간(월 04시 ~ 익주 월 00시 KST)을 엄격히 준수한다', async () => {
    // 2026-W41 종료는 2026-10-12 00:00 KST = 2026-10-11 15:00:00 UTC
    // 시즌 내 적립
    await testDb.commitEndlessClear('user_1', 'stage_1', {
      earned: 50,
      season: '2026-W41',
      seedLeft: 10,
      elapsedMs: 20000,
      suspicious: false,
      atIso: '2026-10-10T10:00:00Z',
    });
    // 마감 창(월 00~04시 KST) 적립 (2026-10-11 16:00:00 UTC = 2026-10-12 01:00 KST)
    await testDb.commitEndlessClear('user_1', 'stage_2', {
      earned: 100,
      season: '2026-W41',
      seedLeft: 10,
      elapsedMs: 20000,
      suspicious: false,
      atIso: '2026-10-11T16:00:00Z',
    });

    vi.useFakeTimers();
    // 스케줄이 2일 지연되어 2026-10-14에 실행되었다고 가정
    vi.setSystemTime(new Date('2026-10-13T15:00:00Z'));

    const req = new Request('http://localhost/api/internal/ranking-finalize', {
      method: 'POST',
      headers: { authorization: `Bearer ${TEST_SECRET}` },
      body: JSON.stringify({ season: '2026-W41' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.results).toHaveLength(1);
    // 마감 창 100점은 제외되고 시즌 내 50점만 집계되어야 함
    expect(body.results[0].score).toBe(50);
  });

  it('미확정된 과거 시즌이 있으면 일일 복구 실행 시 찾아내어 확정한다', async () => {
    // 2026-W40 (2026-09-28 04:00 KST ~ 2026-10-05 00:00 KST) 데이터가 미확정 상태로 남아있음
    await testDb.commitEndlessClear('user_old', 'stage_1', {
      earned: 80,
      season: '2026-W40',
      seedLeft: 10,
      elapsedMs: 20000,
      suspicious: false,
      atIso: '2026-09-30T10:00:00Z',
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T16:00:00Z')); // 2026-W41 마감 시점

    // recover: true 요청 (또는 빈 페이로드)
    const req = new Request('http://localhost/api/internal/ranking-finalize', {
      method: 'POST',
      headers: { authorization: `Bearer ${TEST_SECRET}` },
      body: JSON.stringify({ recover: true }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.recoveredSeasons).toContain('2026-W40');

    // 2026-W40이 정상 확정되었는지 확인
    const finalized = await testDb.getSeasonFinalization('2026-W40');
    expect(finalized).not.toBeNull();
    expect(finalized?.results[0].userId).toBe('user_old');
    expect(finalized?.results[0].score).toBe(80);
  });

  it('새 시즌 시작(월 04시 KST 이후) 시 이전 시즌 확정 실패와 무관하게 새 시즌 조회가 정상 동작한다', async () => {
    // 2026-W41이 미확정 상태인 상황에서 2026-10-12 04:30 KST (2026-10-11 19:30:00 UTC)에 새 시즌 조회
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T19:30:00Z'));

    const res = await getRankRoute();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.season).toBe('2026-W42');
    expect(body.frozen).toBe(false);
  });
});
