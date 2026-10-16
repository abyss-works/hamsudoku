// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestQStashSignature } from '../../../../server/qstashTestHelper';
import { POST } from './route';

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
