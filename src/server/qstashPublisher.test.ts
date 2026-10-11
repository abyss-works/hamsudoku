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

  it('토큰이 없으면 성공 응답을 만들지 않는다', async () => {
    const publisher = createQStashPublisher();
    await expect(publisher.enqueueFinalize('2026-W41')).rejects.toThrow('QStash token is not configured');
    expect(mockPublishedPayload).toBeNull();
  });

  it('목적지 설정이 없으면 운영 주소를 추측하지 않는다', async () => {
    const publisher = createQStashPublisher({ token: 'test-token' });
    await expect(publisher.enqueueFinalize('2026-W41')).rejects.toThrow('QStash destination is not configured');
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
