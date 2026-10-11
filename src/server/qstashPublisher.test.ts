import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQStashPublisher } from './qstashPublisher';

let mockPublishedPayload: unknown = null;

vi.mock('@upstash/qstash', () => {
  return {
    Client: class MockClient {
      publishJSON(opts: unknown) {
        mockPublishedPayload = opts;
        return Promise.resolve({ messageId: 'msg_12345' });
      }
    },
  };
});

describe('createQStashPublisher', () => {
  beforeEach(() => {
    mockPublishedPayload = null;
    delete process.env.QSTASH_TOKEN;
    delete process.env.APP_URL;
  });

  afterEach(() => {
    mockPublishedPayload = null;
    delete process.env.QSTASH_TOKEN;
    delete process.env.APP_URL;
  });

  it('토큰이 없으면 네트워크 요청 없이 noop 응답을 반환한다', async () => {
    const publisher = createQStashPublisher();
    const res = await publisher.enqueueFinalize('2026-W41');
    expect(res.messageId).toBe('noop-no-token');
    expect(mockPublishedPayload).toBeNull();
  });

  it('토큰이 있으면 deduplicationId와 함께 publishJSON을 호출한다', async () => {
    const publisher = createQStashPublisher({
      token: 'test_token',
      destinationUrl: 'https://example.com/api/internal/ranking-finalize',
    });
    const res = await publisher.enqueueFinalize('2026-W41');

    expect(res.messageId).toBe('msg_12345');
    expect(mockPublishedPayload).toEqual({
      url: 'https://example.com/api/internal/ranking-finalize',
      body: { season: '2026-W41', recover: true },
      deduplicationId: 'finalize-2026-W41',
    });
  });
});
