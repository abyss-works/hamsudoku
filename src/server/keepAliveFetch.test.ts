import { describe, expect, it } from 'vitest';
import { createServerFetch, KEEP_ALIVE_OPTIONS, keepAliveAgent } from './keepAliveFetch';

describe('createServerFetch', () => {
  it('요청 옵션을 유지하고 지정한 dispatcher로 보낸다', async () => {
    const calls: { input: unknown; init: Record<string, unknown> }[] = [];
    const base = async (input: unknown, init?: Record<string, unknown>) => {
      calls.push({ input, init: init ?? {} });
      return new Response('ok');
    };
    const dispatcher = { name: 'agent' };
    const serverFetch = createServerFetch(base as unknown as typeof fetch, dispatcher);

    await serverFetch('https://example.com/x', { method: 'POST', body: 'b' });

    expect(calls).toEqual([{ input: 'https://example.com/x', init: { method: 'POST', body: 'b', dispatcher } }]);
  });
});

describe('keepAliveAgent', () => {
  it('유휴 연결을 60초까지 유지하는 Agent를 프로세스에서 하나만 만든다', () => {
    expect(KEEP_ALIVE_OPTIONS).toEqual({ keepAliveTimeout: 60_000, keepAliveMaxTimeout: 60_000 });
    expect(keepAliveAgent()).toBe(keepAliveAgent());
  });
});
