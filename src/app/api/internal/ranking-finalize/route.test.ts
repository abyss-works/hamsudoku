// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestQStashSignature } from '../../../../server/qstashTestHelper';
import { POST } from './route';

const finalization = vi.hoisted(() => ({ error: null as Error | null }));

vi.mock('../../../../server/seasonRanking/finalization', async (original) => {
  const actual = await original<typeof import('../../../../server/seasonRanking/finalization')>();
  return {
    ...actual,
    finalizeSeason: async () => {
      throw finalization.error;
    },
    recoverUnfinalizedSeasons: async () => {
      throw finalization.error;
    },
  };
});

const TEST_SECRET = 'test_internal_secret_value';
const TEST_KEY = 'test_qstash_signing_key';

describe('/api/internal/ranking-finalize 요청 인증과 형식 검증', () => {
  beforeEach(() => {
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
});

describe('/api/internal/ranking-finalize 실패 응답', () => {
  beforeEach(() => {
    process.env.INTERNAL_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.INTERNAL_SECRET;
    finalization.error = null;
  });

  function finalize() {
    return POST(
      new Request('http://localhost/api/internal/ranking-finalize', {
        method: 'POST',
        headers: { authorization: `Bearer ${TEST_SECRET}` },
        body: JSON.stringify({ season: '2026-W41' }),
      }),
    );
  }

  it('DB 오류는 쿼리 인자를 응답과 로그에 싣지 않는다', async () => {
    finalization.error = Object.assign(new Error('Failed query: insert into "SeasonRankResult" values ($1)\nparams: secret-user'), {
      cause: { code: '23505', constraint: 'SeasonRankResult_pkey', table: 'SeasonRankResult' },
    });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await finalize();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('secret-user');
    expect(JSON.stringify(logged.mock.calls)).not.toContain('secret-user');
    expect(logged).toHaveBeenCalledWith('Ranking finalization failed', expect.objectContaining({ code: '23505' }));
  });

  it('끝나지 않은 시즌의 확정 요청은 사유를 그대로 반환한다', async () => {
    const { SeasonNotEndedError } = await import('../../../../server/seasonRanking/finalization');
    finalization.error = new SeasonNotEndedError('2026-W41', new Date('2026-10-11T15:00:00.000Z'));

    const res = await finalize();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      ok: false,
      msg: 'Season 2026-W41 has not ended yet (ends at 2026-10-11T15:00:00.000Z)',
    });
  });
});
