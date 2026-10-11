import { Receiver } from '@upstash/qstash';
import { qstashProtectionHeaders } from './qstashHeaders';
import { timingSafeEqual } from 'node:crypto';

export interface VerifyQStashOptions {
  signature: string | null | undefined;
  body?: string;
  url?: string;
  currentSigningKey?: string;
  nextSigningKey?: string;
  clockTolerance?: number;
}

export interface QStashVerifyOptions {
  currentSigningKey?: string;
  nextSigningKey?: string;
  clockTolerance?: number;
}

export interface QStashVerifier {
  verify(req: Request, rawBody: string): Promise<boolean>;
}

/**
 * 공식 @upstash/qstash Receiver를 사용하여 QStash 웹훅 서명을 검증한다.
 * URL(sub), body hash, issuer(Upstash), 만료시간(exp), not-before(nbf), 서명 키 회전을 검증한다.
 */
async function verifyQStashSignatureInternal(options: VerifyQStashOptions): Promise<boolean> {
  const {
    signature,
    body = '',
    url,
    currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY,
    clockTolerance = 300,
  } = options;

  if (!signature) return false;
  if (!currentSigningKey && !nextSigningKey) return false;

  // Receiver는 currentSigningKey와 nextSigningKey가 둘 다 제공되어야 동작하므로 회전 전 단일 키 상태면 폴백한다.
  const receiver = new Receiver({
    currentSigningKey: currentSigningKey || nextSigningKey,
    nextSigningKey: nextSigningKey || currentSigningKey,
  });

  try {
    return await receiver.verify({
      signature,
      body,
      url,
      clockTolerance,
    });
  } catch {
    return false;
  }
}

export async function verifyQStashSignature(options: VerifyQStashOptions): Promise<boolean>;
export async function verifyQStashSignature(
  req: Request,
  rawBody: string,
  options?: QStashVerifyOptions,
): Promise<boolean>;
export async function verifyQStashSignature(
  arg1: VerifyQStashOptions | Request,
  arg2?: string,
  arg3?: QStashVerifyOptions,
): Promise<boolean> {
  if (
    arg1 instanceof Request ||
    (typeof arg1 === 'object' && arg1 !== null && 'headers' in arg1 && typeof arg2 === 'string')
  ) {
    const req = arg1 as Request;
    const rawBody = arg2 as string;
    const options = arg3;
    const signature = req.headers.get('upstash-signature');
    if (!signature) return false;
    return verifyQStashSignatureInternal({
      signature,
      body: rawBody,
      url: req.url,
      currentSigningKey: options?.currentSigningKey,
      nextSigningKey: options?.nextSigningKey,
      clockTolerance: options?.clockTolerance,
    });
  }
  return verifyQStashSignatureInternal(arg1 as VerifyQStashOptions);
}

export class OfficialQStashVerifier implements QStashVerifier {
  private options: QStashVerifyOptions;

  constructor(options: QStashVerifyOptions = {}) {
    this.options = options;
  }

  async verify(req: Request, rawBody: string): Promise<boolean> {
    return verifyQStashSignature(req, rawBody, this.options);
  }
}

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * 내부 작업 요청 인증을 수행한다.
 * 1. QStash 서명(upstash-signature 헤더)을 우선 검증한다.
 * 2. QStash 서명이 없거나 유효하지 않은 경우, 관리자/긴급 수동 호출을 위해 의도적으로 Bearer admin fallback을 timing-safe 비교로 검증한다.
 */
export async function verifyInternalRequest(
  req: Request,
  rawBody: string,
  env: Record<string, string | undefined> = process.env,
): Promise<boolean> {
  const qstashSig = req.headers.get('upstash-signature');
  if (qstashSig) {
    const ok = await verifyQStashSignature({
      signature: qstashSig,
      body: rawBody,
      url: req.url,
      currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
    });
    if (ok) return true;
  }

  // Bearer admin fallback: 의도적으로 별도 명시된 관리자 및 수동 복구용 경로 (timing-safe 비교)
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const internalSecret = env.INTERNAL_SECRET || env.CRON_SECRET;
    if (internalSecret && safeCompare(token, internalSecret)) {
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
  if (!token) {
    throw new Error('QStash publish failed: QSTASH_TOKEN is not configured');
  }

  const destinationUrl =
    options?.destinationUrl ??
    (process.env.APP_URL ? `${process.env.APP_URL}/api/internal/endless-generate` : undefined);
  if (!destinationUrl) {
    throw new Error('QStash publish failed: APP_URL is not configured');
  }

  const baseUrl = (process.env.QSTASH_URL || 'https://qstash.upstash.io').replace(/\/+$/, '');
  const qstashUrl = `${baseUrl}/v2/publish/${destinationUrl}`;
  const res = await fetch(qstashUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Upstash-Retries': '3',
      ...Object.fromEntries(Object.entries(qstashProtectionHeaders()).map(([key, value]) => [`Upstash-Forward-${key}`, value])),
    },
    body: JSON.stringify({ jobId, chunkIndex }),
  });

  if (!res.ok) {
    throw new Error(`QStash publish failed with status ${res.status}`);
  }

  const data = (await res.json()) as { messageId: string };
  return { messageId: data.messageId };
}
