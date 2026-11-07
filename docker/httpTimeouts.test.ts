import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

describe('httpTimeouts 사전 로드 스크립트', () => {
  it('listen하는 HTTP 서버에 keepAliveTimeout 65초와 headersTimeout 66초를 적용한다', async () => {
    const { install, KEEP_ALIVE_TIMEOUT_MS, HEADERS_TIMEOUT_MS } = require('./httpTimeouts.cjs');
    const restore = install();
    const server = createServer();
    try {
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      expect(server.keepAliveTimeout).toBe(65_000);
      expect(server.headersTimeout).toBe(66_000);
      expect(KEEP_ALIVE_TIMEOUT_MS).toBe(65_000);
      expect(HEADERS_TIMEOUT_MS).toBeGreaterThan(KEEP_ALIVE_TIMEOUT_MS);
    } finally {
      await new Promise((resolve) => server.close(resolve));
      restore();
    }
  });

  it('복원하면 listen이 원래 동작으로 돌아간다', async () => {
    const { install } = require('./httpTimeouts.cjs');
    const restore = install();
    restore();
    const server = createServer();
    try {
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      expect(server.keepAliveTimeout).toBe(5_000);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
