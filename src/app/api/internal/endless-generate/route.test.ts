import { describe, expect, it } from 'vitest';
import { POST } from './route';

describe('/api/internal/endless-generate route', () => {
  const url = 'https://hamsudoku.abyssworks.dev/api/internal/endless-generate';

  it('서명 헤더가 없거나 유효하지 않으면 401을 반환한다', async () => {
    const req = new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jobId: 'job-1', chunkIndex: 0 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('본문 형식이 올바르지 않으면 400을 반환한다', async () => {
    const req = new Request(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-test-bypass': 'true', // 테스트 전용 서명 우회
      },
      body: JSON.stringify({ wrongField: 123 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
