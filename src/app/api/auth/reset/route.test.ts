// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { POST } from './route';
import { requestPasswordReset } from '../../../../server/auth';

vi.mock('../../../../server/auth', () => ({
  requestPasswordReset: vi.fn(async () => ({ ok: true })),
}));

const limiter = vi.hoisted(() => vi.fn(async () => ({ success: true, reset: 0 })));
vi.mock('../../../../server/rateLimit', async (original) => ({
  ...(await original<typeof import('../../../../server/rateLimit')>()),
  rateLimiterFromEnv: () => limiter,
}));

const req = (body: unknown) =>
  new Request('http://localhost/api/auth/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
    body: JSON.stringify(body),
  });

describe('POST /api/auth/reset 요청 속도 제한', () => {
  it('한도 안이면 재설정 메일을 요청한다', async () => {
    const res = await POST(req({ email: 'a@b.co' }));

    expect(res.status).toBe(200);
    expect(limiter).toHaveBeenCalledWith('reset', '1.2.3.4');
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
  });

  it('한도를 넘으면 429를 반환하고 메일을 요청하지 않는다', async () => {
    vi.mocked(requestPasswordReset).mockClear();
    limiter.mockResolvedValueOnce({ success: false, reset: Date.now() + 60_000 });

    const res = await POST(req({ email: 'a@b.co' }));

    expect(res.status).toBe(429);
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });
});
