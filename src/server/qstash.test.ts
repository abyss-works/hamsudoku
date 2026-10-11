import { describe, expect, it } from 'vitest';
import {
  computeBodyHash,
  createTestQStashSignature,
  verifyInternalRequest,
  verifyQStashSignature,
} from './qstash';

describe('QStash 서명 검증 (src/server/qstash)', () => {
  const currentKey = 'sigkey_current_12345';
  const nextKey = 'sigkey_next_67890';

  it('유효한 current key 서명을 정상 검증한다', () => {
    const body = JSON.stringify({ season: '2026-W41' });
    const sig = createTestQStashSignature(
      { iss: 'Upstash', exp: Math.floor(Date.now() / 1000) + 300 },
      currentKey,
    );
    expect(
      verifyQStashSignature({
        signature: sig,
        body,
        currentSigningKey: currentKey,
      }),
    ).toBe(true);
  });

  it('유효한 next key 서명을 정상 검증한다', () => {
    const body = '';
    const sig = createTestQStashSignature(
      { iss: 'Upstash', exp: Math.floor(Date.now() / 1000) + 300 },
      nextKey,
    );
    expect(
      verifyQStashSignature({
        signature: sig,
        body,
        currentSigningKey: currentKey,
        nextSigningKey: nextKey,
      }),
    ).toBe(true);
  });

  it('잘못된 서명 키는 검증에 실패한다', () => {
    const body = '';
    const sig = createTestQStashSignature(
      { iss: 'Upstash', exp: Math.floor(Date.now() / 1000) + 300 },
      'wrong_key',
    );
    expect(
      verifyQStashSignature({
        signature: sig,
        body,
        currentSigningKey: currentKey,
      }),
    ).toBe(false);
  });

  it('만료된 서명은 검증에 실패한다', () => {
    const body = '';
    const sig = createTestQStashSignature(
      { iss: 'Upstash', exp: Math.floor(Date.now() / 1000) - 100 },
      currentKey,
    );
    expect(
      verifyQStashSignature({
        signature: sig,
        body,
        currentSigningKey: currentKey,
      }),
    ).toBe(false);
  });

  it('본문 해시가 일치하면 정상 검증한다', () => {
    const body = JSON.stringify({ season: '2026-W41' });
    const hashes = computeBodyHash(body);
    const sig = createTestQStashSignature(
      { iss: 'Upstash', exp: Math.floor(Date.now() / 1000) + 300, body: hashes.base64url },
      currentKey,
    );
    expect(
      verifyQStashSignature({
        signature: sig,
        body,
        currentSigningKey: currentKey,
      }),
    ).toBe(true);
  });

  it('본문 해시가 일치하지 않으면 검증에 실패한다', () => {
    const body = 'hello';
    const sig = createTestQStashSignature(
      { iss: 'Upstash', exp: Math.floor(Date.now() / 1000) + 300, body: 'wrong-hash' },
      currentKey,
    );
    expect(
      verifyQStashSignature({
        signature: sig,
        body,
        currentSigningKey: currentKey,
      }),
    ).toBe(false);
  });

  it('서명 헤더가 없으면 실패한다', () => {
    expect(
      verifyQStashSignature({
        signature: null,
        body: '',
        currentSigningKey: currentKey,
      }),
    ).toBe(false);
  });

  it('verifyInternalRequest: QStash 서명 인증을 처리한다', () => {
    const body = '{"season":"2026-W41"}';
    const sig = createTestQStashSignature(
      { iss: 'Upstash', exp: Math.floor(Date.now() / 1000) + 300 },
      currentKey,
    );
    const req = new Request('http://localhost/api/internal/ranking-finalize', {
      method: 'POST',
      headers: { 'upstash-signature': sig },
      body,
    });
    expect(
      verifyInternalRequest(req, body, {
        QSTASH_CURRENT_SIGNING_KEY: currentKey,
      }),
    ).toBe(true);
  });

  it('verifyInternalRequest: INTERNAL_SECRET Bearer 토큰 인증을 처리한다', () => {
    const body = '';
    const req = new Request('http://localhost/api/internal/ranking-finalize', {
      method: 'POST',
      headers: { authorization: 'Bearer super_internal_secret' },
    });
    expect(
      verifyInternalRequest(req, body, {
        INTERNAL_SECRET: 'super_internal_secret',
      }),
    ).toBe(true);
  });

  it('verifyInternalRequest: 잘못된 인증 정보는 거부한다', () => {
    const req = new Request('http://localhost/api/internal/ranking-finalize', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong_token' },
    });
    expect(
      verifyInternalRequest(req, '', {
        INTERNAL_SECRET: 'super_internal_secret',
      }),
    ).toBe(false);
  });
});
