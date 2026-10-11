import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export interface VerifyQStashOptions {
  signature: string | null | undefined;
  body?: string;
  currentSigningKey?: string;
  nextSigningKey?: string;
  clockToleranceSeconds?: number;
}

export function computeBodyHash(body: string): { base64: string; base64url: string } {
  const hash = createHash('sha256').update(body).digest();
  return {
    base64: hash.toString('base64'),
    base64url: hash.toString('base64url'),
  };
}

export function createTestQStashSignature(
  claims: {
    iss?: string;
    sub?: string;
    exp?: number;
    nbf?: number;
    body?: string;
    [key: string]: unknown;
  },
  key: string,
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encode = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsignedToken = `${encode(header)}.${encode(claims)}`;
  const sig = createHmac('sha256', key).update(unsignedToken).digest('base64url');
  return `${unsignedToken}.${sig}`;
}

export function verifyQStashSignature(options: VerifyQStashOptions): boolean {
  const {
    signature,
    body,
    currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY,
    clockToleranceSeconds = 300,
  } = options;

  if (!signature) return false;

  const keys = [currentSigningKey, nextSigningKey].filter((k): k is string => Boolean(k));
  if (keys.length === 0) return false;

  const parts = signature.split('.');
  if (parts.length !== 3) return false;

  const [headerB64, payloadB64, sigB64] = parts;
  const unsignedToken = `${headerB64}.${payloadB64}`;

  let validKey = false;
  let sigBuf: Buffer;
  try {
    sigBuf = Buffer.from(sigB64, 'base64url');
  } catch {
    return false;
  }

  for (const key of keys) {
    const expectedSigBuf = createHmac('sha256', key).update(unsignedToken).digest();
    if (sigBuf.length === expectedSigBuf.length && timingSafeEqual(sigBuf, expectedSigBuf)) {
      validKey = true;
      break;
    }
  }
  if (!validKey) return false;

  try {
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);

    if (payload.iss && payload.iss !== 'Upstash') return false;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp < now) {
      return false;
    }
    if (typeof payload.nbf === 'number' && payload.nbf > now + clockToleranceSeconds) {
      return false;
    }

    if (payload.body !== undefined && body !== undefined) {
      const hashes = computeBodyHash(body);
      if (payload.body !== hashes.base64 && payload.body !== hashes.base64url) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

export function verifyInternalRequest(
  req: Request,
  rawBody: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const qstashSig = req.headers.get('upstash-signature');
  if (qstashSig) {
    const ok = verifyQStashSignature({
      signature: qstashSig,
      body: rawBody,
      currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
    });
    if (ok) return true;
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const internalSecret = env.INTERNAL_SECRET || env.CRON_SECRET;
    if (internalSecret && token === internalSecret) {
      return true;
    }
  }

  return false;
}
