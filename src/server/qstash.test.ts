import crypto from 'node:crypto';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { publishQStashChunk, verifyQStashSignature } from './qstash';

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function createTestSignature(
  url: string,
  rawBody: string,
  key: string,
  options?: { expOffset?: number; nbfOffset?: number },
): string {
  const bodyHash = crypto.createHash('sha256').update(rawBody).digest('base64url');
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iss: 'Upstash',
    sub: url,
    body: bodyHash,
    iat: now,
    nbf: now + (options?.nbfOffset ?? 0),
    exp: now + (options?.expOffset ?? 300),
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  const sig = crypto.createHmac('sha256', key).update(dataToSign).digest('base64url');
  return `${dataToSign}.${sig}`;
}

describe('QStash security and verification', () => {
  const originalEnv = process.env;
  const currentKey = 'sigkey_current_secret_key_12345';
  const nextKey = 'sigkey_next_secret_key_67890';
  const testUrl = 'http://localhost/api/internal/endless-generate';
  const rawBody = JSON.stringify({ jobId: 'job-1', chunkIndex: 0 });

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('x-internal-test-bypass 헤더가 있어도 인증을 우회하지 않고 거부한다', async () => {
    const req = new Request(testUrl, {
      method: 'POST',
      headers: {
        'x-internal-test-bypass': 'true',
      },
      body: rawBody,
    });

    const valid = await verifyQStashSignature(req, rawBody);
    expect(valid).toBe(false);
  });

  it('서명 헤더가 없으면 거부한다', async () => {
    const req = new Request(testUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: rawBody,
    });

    const valid = await verifyQStashSignature(req, rawBody);
    expect(valid).toBe(false);
  });

  it('공식 Receiver 규칙에 따라 유효한 HS256 JWT 서명이면 검증을 통과한다', async () => {
    const signature = createTestSignature(testUrl, rawBody, currentKey);
    const req = new Request(testUrl, {
      method: 'POST',
      headers: {
        'upstash-signature': signature,
        'content-type': 'application/json',
      },
      body: rawBody,
    });

    const valid = await verifyQStashSignature(req, rawBody, { currentSigningKey: currentKey });
    expect(valid).toBe(true);
  });

  it('키 교체 시 nextSigningKey로 생성된 서명도 검증을 통과한다', async () => {
    const signature = createTestSignature(testUrl, rawBody, nextKey);
    const req = new Request(testUrl, {
      method: 'POST',
      headers: {
        'upstash-signature': signature,
      },
      body: rawBody,
    });

    const valid = await verifyQStashSignature(req, rawBody, {
      currentSigningKey: currentKey,
      nextSigningKey: nextKey,
    });
    expect(valid).toBe(true);
  });

  it('본문이 변조되어 해시가 불일치하면 거부한다', async () => {
    const signature = createTestSignature(testUrl, rawBody, currentKey);
    const tamperedBody = JSON.stringify({ jobId: 'job-1', chunkIndex: 99 });
    const req = new Request(testUrl, {
      method: 'POST',
      headers: {
        'upstash-signature': signature,
      },
      body: tamperedBody,
    });

    const valid = await verifyQStashSignature(req, tamperedBody, { currentSigningKey: currentKey });
    expect(valid).toBe(false);
  });

  it('토큰이 설정되지 않았을 때 모의 성공을 반환하지 않고 명시적으로 실패한다', async () => {
    delete process.env.QSTASH_TOKEN;
    delete process.env.APP_URL;

    await expect(publishQStashChunk('job-1', 0)).rejects.toThrow(
      'QStash publish failed: QSTASH_TOKEN is not configured',
    );
  });

  it('APP_URL이 설정되지 않았을 때 기본 프로덕션 URL로 대체하지 않고 명시적으로 실패한다', async () => {
    process.env.QSTASH_TOKEN = 'test-token';
    delete process.env.APP_URL;

    await expect(publishQStashChunk('job-1', 0)).rejects.toThrow(
      'QStash publish failed: APP_URL is not configured',
    );
  });

  it('발행 응답 오류 시 비밀이 노출될 수 있는 본문을 제외하고 상태 중심 오류를 발생시킨다', async () => {
    process.env.QSTASH_TOKEN = 'test-token';
    process.env.APP_URL = 'http://staging.example.com';

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'secret_internal_token_leaked_response_body',
    } as Response);

    await expect(publishQStashChunk('job-1', 0)).rejects.toThrow(
      'QStash publish failed with status 401',
    );
  });

  it('발행 성공 시 messageId를 반환한다', async () => {
    process.env.QSTASH_TOKEN = 'test-token';
    process.env.APP_URL = 'http://staging.example.com';

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ messageId: 'msg-success-123' }),
    } as Response);

    const res = await publishQStashChunk('job-1', 0);
    expect(res.messageId).toBe('msg-success-123');
  });
});
