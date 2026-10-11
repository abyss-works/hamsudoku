import { describe, expect, it } from 'vitest';
import { signQStashPayload, verifyQStashSignature } from './qstash';

describe('QStash signature verification', () => {
  const testKey = 'sigkey_test_current_secret_key_123';
  const url = 'https://hamsudoku.abyssworks.dev/api/internal/endless-generate';
  const rawBody = JSON.stringify({ jobId: 'job-1', chunkIndex: 0 });

  it('올바른 서명과 본문이 주어지면 검증을 통과한다', async () => {
    const token = signQStashPayload(url, rawBody, testKey);
    const req = new Request(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'upstash-signature': token,
      },
      body: rawBody,
    });

    const valid = await verifyQStashSignature(req, rawBody, { currentSigningKey: testKey });
    expect(valid).toBe(true);
  });

  it('서명 헤더가 없으면 거부한다', async () => {
    const req = new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: rawBody,
    });

    const valid = await verifyQStashSignature(req, rawBody, { currentSigningKey: testKey });
    expect(valid).toBe(false);
  });

  it('다른 키로 서명된 토큰은 거부한다', async () => {
    const wrongKey = 'sigkey_different_wrong_key_456';
    const token = signQStashPayload(url, rawBody, wrongKey);
    const req = new Request(url, {
      method: 'POST',
      headers: { 'upstash-signature': token },
      body: rawBody,
    });

    const valid = await verifyQStashSignature(req, rawBody, { currentSigningKey: testKey });
    expect(valid).toBe(false);
  });

  it('본문이 변조되었으면 거부한다', async () => {
    const token = signQStashPayload(url, rawBody, testKey);
    const tamperedBody = JSON.stringify({ jobId: 'job-1', chunkIndex: 999 });
    const req = new Request(url, {
      method: 'POST',
      headers: { 'upstash-signature': token },
      body: tamperedBody,
    });

    const valid = await verifyQStashSignature(req, tamperedBody, { currentSigningKey: testKey });
    expect(valid).toBe(false);
  });

  it('nextSigningKey로 서명된 경우에도 통과한다', async () => {
    const nextKey = 'sigkey_test_next_secret_key_789';
    const token = signQStashPayload(url, rawBody, nextKey);
    const req = new Request(url, {
      method: 'POST',
      headers: { 'upstash-signature': token },
      body: rawBody,
    });

    const valid = await verifyQStashSignature(req, rawBody, {
      currentSigningKey: testKey,
      nextSigningKey: nextKey,
    });
    expect(valid).toBe(true);
  });
});
