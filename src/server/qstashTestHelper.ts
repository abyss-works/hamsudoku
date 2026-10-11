import { createHash, createHmac } from 'node:crypto';

export interface TestQStashClaims {
  iss?: string;
  sub?: string;
  exp?: number;
  nbf?: number;
  body?: string;
  [key: string]: unknown;
}

export function computeBodyHash(body: string): { base64: string; base64url: string } {
  const hash = createHash('sha256').update(body).digest();
  return {
    base64: hash.toString('base64'),
    base64url: hash.toString('base64url'),
  };
}

/**
 * 테스트용 QStash JWT 서명 생성 헬퍼.
 * 공식 @upstash/qstash Receiver 규격(iss: Upstash, sub: url, exp, nbf, body 해시)에 맞추어 생성한다.
 */
export function createTestQStashSignature(
  claims: TestQStashClaims,
  key: string,
  rawBody?: string,
): string {
  const now = Math.floor(Date.now() / 1000);
  let resolvedBodyHash: string | undefined = claims.body;
  if (resolvedBodyHash === undefined) {
    if (rawBody !== undefined) {
      resolvedBodyHash = computeBodyHash(rawBody).base64url;
    } else {
      resolvedBodyHash = computeBodyHash('').base64url;
    }
  }

  const resolvedClaims: Record<string, unknown> = {
    iss: 'Upstash',
    sub: 'http://localhost/api/internal/ranking-finalize',
    exp: now + 300,
    nbf: now - 10,
    ...claims,
  };

  if (resolvedBodyHash !== undefined) {
    resolvedClaims.body = resolvedBodyHash;
  }

  const header = { alg: 'HS256', typ: 'JWT' };
  const encode = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsignedToken = `${encode(header)}.${encode(resolvedClaims)}`;
  const sig = createHmac('sha256', key).update(unsignedToken).digest('base64url');
  return `${unsignedToken}.${sig}`;
}
