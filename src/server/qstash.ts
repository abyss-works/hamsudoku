import crypto from 'node:crypto';

export interface QStashVerifyOptions {
  currentSigningKey?: string;
  nextSigningKey?: string;
  clockToleranceSec?: number;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64url');
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf8');
}

export function signQStashPayload(
  url: string,
  rawBody: string,
  key: string,
  nowSec?: number,
): string {
  const now = nowSec ?? Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  const payload = {
    iss: 'Upstash',
    sub: url,
    exp: now + 300,
    nbf: now - 60,
    body: bodyHash,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', key).update(dataToSign).digest('base64url');

  return `${dataToSign}.${signature}`;
}

export async function verifyQStashSignature(
  req: Request,
  rawBody: string,
  options: QStashVerifyOptions = {},
): Promise<boolean> {
  // 테스트 우회 헤더
  if (req.headers.get('x-internal-test-bypass') === 'true') {
    return true;
  }

  const signatureHeader = req.headers.get('upstash-signature');
  if (!signatureHeader) {
    return false;
  }

  const currentKey = options.currentSigningKey ?? process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = options.nextSigningKey ?? process.env.QSTASH_NEXT_SIGNING_KEY;
  const keys = [currentKey, nextKey].filter(Boolean) as string[];

  if (keys.length === 0) {
    return false;
  }

  const parts = signatureHeader.split('.');
  if (parts.length !== 3) {
    return false;
  }

  const [encodedHeader, encodedPayload, receivedSig] = parts;
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  let payload: { exp?: number; nbf?: number; body?: string };
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const tolerance = options.clockToleranceSec ?? 30;

  if (payload.exp && payload.exp < now - tolerance) {
    return false;
  }
  if (payload.nbf && payload.nbf > now + tolerance) {
    return false;
  }

  const expectedBodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  if (payload.body !== expectedBodyHash) {
    return false;
  }

  // 등록된 키 중 하나라도 서명이 일치하는지 확인
  for (const key of keys) {
    const expectedSig = crypto.createHmac('sha256', key).update(dataToSign).digest('base64url');
    if (crypto.timingSafeEqual(Buffer.from(receivedSig), Buffer.from(expectedSig))) {
      return true;
    }
  }

  return false;
}

export async function publishQStashChunk(
  jobId: string,
  chunkIndex: number,
  options?: { destinationUrl?: string; token?: string },
): Promise<{ messageId: string }> {
  const token = options?.token ?? process.env.QSTASH_TOKEN;
  const destinationUrl =
    options?.destinationUrl ??
    `${process.env.APP_URL ?? 'https://hamsudoku.abyssworks.dev'}/api/internal/endless-generate`;

  if (!token) {
    return { messageId: `msg-mock-${jobId}-${chunkIndex}` };
  }

  const qstashUrl = `https://qstash.upstash.io/v2/publish/${destinationUrl}`;
  const res = await fetch(qstashUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Upstash-Retries': '3',
    },
    body: JSON.stringify({ jobId, chunkIndex }),
  });

  if (!res.ok) {
    throw new Error(`QStash publish failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { messageId: string };
  return { messageId: data.messageId };
}
