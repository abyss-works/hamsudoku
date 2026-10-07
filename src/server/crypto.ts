const HKDF_INFO = 'hamsudoku:endless:solution:v1';

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Buffer.from(value, 'base64'));
}

export async function encryptSolution(
  clientPublicKey: string,
  solutionText: string,
): Promise<{ solutionCipher: string; serverPublicKey: string; iv: string }> {
  const subtle = globalThis.crypto.subtle;
  const clientKey = await subtle.importKey('raw', base64ToBytes(clientPublicKey), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const server = (await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const shared = await subtle.deriveBits({ name: 'ECDH', public: clientKey }, server.privateKey, 256);
  const hkdfKey = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  const aesKey = await subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: new TextEncoder().encode(HKDF_INFO) },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const cipher = await subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, new TextEncoder().encode(solutionText));
  const serverPublic = await subtle.exportKey('raw', server.publicKey);
  return {
    solutionCipher: bytesToBase64(new Uint8Array(cipher)),
    serverPublicKey: bytesToBase64(new Uint8Array(serverPublic)),
    iv: bytesToBase64(iv),
  };
}
