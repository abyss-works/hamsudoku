import { describe, expect, it } from 'vitest';
import { verifyInternalRequest, verifyQStashSignature } from './qstash';
import { computeBodyHash, createTestQStashSignature } from './qstashTestHelper';

describe('QStash 서명 검증 (공식 @upstash/qstash Receiver)', () => {
  const currentKey = 'sigkey_current_12345';
  const nextKey = 'sigkey_next_67890';
  const targetUrl = 'https://hamsudoku.abyssworks.dev/api/internal/ranking-finalize';

  it('유효한 current key 서명을 정상 검증한다', async () => {
    const body = JSON.stringify({ season: '2026-W41' });
    const sig = createTestQStashSignature(
      { iss: 'Upstash', sub: targetUrl, exp: Math.floor(Date.now() / 1000) + 300 },
      currentKey,
      body,
    );
    expect(
      await verifyQStashSignature({
        signature: sig,
        body,
        url: targetUrl,
        currentSigningKey: currentKey,
      }),
    ).toBe(true);
  });

  it('키 회전 시 next key 서명을 정상 검증한다', async () => {
    const body = '';
    const sig = createTestQStashSignature(
      { iss: 'Upstash', sub: targetUrl, exp: Math.floor(Date.now() / 1000) + 300 },
      nextKey,
      body,
    );
    expect(
      await verifyQStashSignature({
        signature: sig,
        body,
        url: targetUrl,
        currentSigningKey: currentKey,
        nextSigningKey: nextKey,
      }),
    ).toBe(true);
  });

  it('잘못된 서명 키는 검증에 실패한다', async () => {
    const body = '';
    const sig = createTestQStashSignature(
      { iss: 'Upstash', sub: targetUrl, exp: Math.floor(Date.now() / 1000) + 300 },
      'wrong_key',
      body,
    );
    expect(
      await verifyQStashSignature({
        signature: sig,
        body,
        url: targetUrl,
        currentSigningKey: currentKey,
      }),
    ).toBe(false);
  });

  it('만료된 서명(exp in past)은 검증에 실패한다', async () => {
    const body = '';
    const sig = createTestQStashSignature(
      { iss: 'Upstash', sub: targetUrl, exp: Math.floor(Date.now() / 1000) - 100 },
      currentKey,
      body,
    );
    expect(
      await verifyQStashSignature({
        signature: sig,
        body,
        url: targetUrl,
        currentSigningKey: currentKey,
        clockTolerance: 0,
      }),
    ).toBe(false);
  });

  it('destination sub가 일치하지 않으면 검증에 실패한다', async () => {
    const body = '';
    const sig = createTestQStashSignature(
      { iss: 'Upstash', sub: 'https://attacker.com/webhook', exp: Math.floor(Date.now() / 1000) + 300 },
      currentKey,
      body,
    );
    expect(
      await verifyQStashSignature({
        signature: sig,
        body,
        url: targetUrl,
        currentSigningKey: currentKey,
      }),
    ).toBe(false);
  });

  it('본문 해시가 일치하면 정상 검증한다', async () => {
    const body = JSON.stringify({ season: '2026-W41' });
    const hashes = computeBodyHash(body);
    const sig = createTestQStashSignature(
      { iss: 'Upstash', sub: targetUrl, exp: Math.floor(Date.now() / 1000) + 300, body: hashes.base64url },
      currentKey,
    );
    expect(
      await verifyQStashSignature({
        signature: sig,
        body,
        url: targetUrl,
        currentSigningKey: currentKey,
      }),
    ).toBe(true);
  });

  it('본문 해시가 일치하지 않으면 검증에 실패한다', async () => {
    const body = 'hello';
    const sig = createTestQStashSignature(
      { iss: 'Upstash', sub: targetUrl, exp: Math.floor(Date.now() / 1000) + 300, body: 'wrong-hash' },
      currentKey,
    );
    expect(
      await verifyQStashSignature({
        signature: sig,
        body,
        url: targetUrl,
        currentSigningKey: currentKey,
      }),
    ).toBe(false);
  });

  it('issuer가 Upstash가 아니면 검증에 실패한다', async () => {
    const body = '';
    const sig = createTestQStashSignature(
      { iss: 'FakeIssuer', sub: targetUrl, exp: Math.floor(Date.now() / 1000) + 300 },
      currentKey,
      body,
    );
    expect(
      await verifyQStashSignature({
        signature: sig,
        body,
        url: targetUrl,
        currentSigningKey: currentKey,
      }),
    ).toBe(false);
  });

  it('서명 헤더가 없으면 실패한다', async () => {
    expect(
      await verifyQStashSignature({
        signature: null,
        body: '',
        currentSigningKey: currentKey,
      }),
    ).toBe(false);
  });

  it('verifyInternalRequest: QStash 서명 인증을 비동기로 처리한다', async () => {
    const body = '{"season":"2026-W41"}';
    const reqUrl = 'http://localhost/api/internal/ranking-finalize';
    const sig = createTestQStashSignature(
      { iss: 'Upstash', sub: reqUrl, exp: Math.floor(Date.now() / 1000) + 300 },
      currentKey,
      body,
    );
    const req = new Request(reqUrl, {
      method: 'POST',
      headers: { 'upstash-signature': sig },
      body,
    });
    expect(
      await verifyInternalRequest(req, body, {
        QSTASH_CURRENT_SIGNING_KEY: currentKey,
      }),
    ).toBe(true);
  });

  it('verifyInternalRequest: INTERNAL_SECRET Bearer 토큰 fallback을 timing-safe하게 처리한다', async () => {
    const body = '';
    const req = new Request('http://localhost/api/internal/ranking-finalize', {
      method: 'POST',
      headers: { authorization: 'Bearer super_internal_secret' },
    });
    expect(
      await verifyInternalRequest(req, body, {
        INTERNAL_SECRET: 'super_internal_secret',
      }),
    ).toBe(true);
  });

  it('verifyInternalRequest: 잘못된 인증 정보는 거부한다', async () => {
    const req = new Request('http://localhost/api/internal/ranking-finalize', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong_token' },
    });
    expect(
      await verifyInternalRequest(req, '', {
        INTERNAL_SECRET: 'super_internal_secret',
      }),
    ).toBe(false);
  });
});
