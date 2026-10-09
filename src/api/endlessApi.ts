import {
  clearResponseSchema,
  meResponseSchema,
  myRankResponseSchema,
  nextResponseSchema,
  rankResponseSchema,
  type ClearResponse,
  type MeResponse,
  type MyRankResponse,
  type RankResponse,
} from '../shared/endless';

const HKDF_INFO = 'hamsudoku:endless:solution:v1';

export class EndlessApiError extends Error {
  constructor(public status: number) {
    super(`endless api ${status}`);
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

export function parseSolution(text: string): [number, number][] {
  return text
    .split(';')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => {
      const [r, c] = p.split(',').map(Number);
      return [r, c] as [number, number];
    });
}

export interface NextStage {
  stage: { id: string; size: number; regions: string };
  solution: [number, number][];
  attemptKey: string;
}

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function nextStage(): Promise<NextStage> {
  const subtle = globalThis.crypto.subtle;
  const client = (await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])) as CryptoKeyPair;
  const clientPublicKey = bytesToBase64(new Uint8Array(await subtle.exportKey('raw', client.publicKey)));
  const res = await postJson('/api/endless/next', { clientPublicKey });
  if (!res.ok) throw new EndlessApiError(res.status);
  const payload = nextResponseSchema.parse(await res.json());
  const serverKey = await subtle.importKey('raw', base64ToBytes(payload.serverPublicKey), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = await subtle.deriveBits({ name: 'ECDH', public: serverKey }, client.privateKey, 256);
  const hkdfKey = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  const aesKey = await subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: new TextEncoder().encode(HKDF_INFO) },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const plain = await subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(payload.iv) },
    aesKey,
    base64ToBytes(payload.solutionCipher),
  );
  return {
    stage: payload.stage,
    solution: parseSolution(new TextDecoder().decode(plain)),
    attemptKey: payload.attemptKey,
  };
}

export async function submitClear(input: {
  attemptKey: string;
  stageId: string;
  solution: [number, number][];
  seedLeft: number;
}): Promise<ClearResponse> {
  const res = await postJson('/api/endless/clear', input);
  if (!res.ok) throw new EndlessApiError(res.status);
  return clearResponseSchema.parse(await res.json());
}

export async function reportFail(attemptKey: string): Promise<void> {
  await postJson('/api/endless/fail', { attemptKey }).catch(() => {});
}

export async function fetchRank(): Promise<RankResponse> {
  const res = await fetch('/api/endless/rank');
  if (!res.ok) throw new EndlessApiError(res.status);
  return rankResponseSchema.parse(await res.json());
}

export async function fetchMyRank(): Promise<MyRankResponse> {
  const res = await fetch('/api/endless/me-rank');
  if (!res.ok) throw new EndlessApiError(res.status);
  return myRankResponseSchema.parse(await res.json());
}

export async function fetchMe(): Promise<MeResponse> {
  const res = await fetch('/api/endless/me');
  if (!res.ok) throw new EndlessApiError(res.status);
  return meResponseSchema.parse(await res.json());
}
