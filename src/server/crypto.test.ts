import { describe, expect, it } from 'vitest';
import { encryptSolution } from './crypto';

const subtle = globalThis.crypto.subtle;
const HKDF_INFO = 'hamsudoku:endless:solution:v1';

function b64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}
function unb64(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Buffer.from(value, 'base64'));
}

async function decryptForClient(
  client: CryptoKeyPair,
  payload: { solutionCipher: string; serverPublicKey: string; iv: string },
): Promise<string> {
  const serverKey = await subtle.importKey('raw', unb64(payload.serverPublicKey), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = await subtle.deriveBits({ name: 'ECDH', public: serverKey }, client.privateKey, 256);
  const hkdfKey = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  const aesKey = await subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: new TextEncoder().encode(HKDF_INFO) },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(payload.iv) }, aesKey, unb64(payload.solutionCipher));
  return new TextDecoder().decode(plain);
}

async function clientKey(): Promise<{ pair: CryptoKeyPair; publicKey: string }> {
  const pair = (await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])) as CryptoKeyPair;
  const publicKey = b64(new Uint8Array(await subtle.exportKey('raw', pair.publicKey)));
  return { pair, publicKey };
}

describe('encryptSolution', () => {
  it('클라이언트 개인키로만 복호화된다', async () => {
    const { pair, publicKey } = await clientKey();
    const payload = await encryptSolution(publicKey, '0,0;1,1');
    expect(await decryptForClient(pair, payload)).toBe('0,0;1,1');
  });

  it('다른 키로는 복호화되지 않는다', async () => {
    const { publicKey } = await clientKey();
    const other = await clientKey();
    const payload = await encryptSolution(publicKey, '0,0;1,1');
    await expect(decryptForClient(other.pair, payload)).rejects.toThrow();
  });
});
