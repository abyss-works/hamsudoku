// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
import { signUpWithEmail } from '../../../../server/auth';

vi.mock('../../../../server/auth', () => ({
  signUpWithEmail: vi.fn(),
  getSessionUser: vi.fn(async () => ({ uid: null, email: null })),
}));

vi.mock('../../../../server/db', () => ({
  createPrismaDb: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

const req = (body: unknown) =>
  new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/auth/signup 상태 코드', () => {
  it('중복 이메일은 409를 내린다', async () => {
    vi.mocked(signUpWithEmail).mockResolvedValue({ ok: false, msg: '이미 가입된 이메일이에요.', code: 'user_already_exists' });
    const res = await POST(req({ email: 'a@b.co', password: '123456' }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ ok: false, code: 'user_already_exists' });
  });

  it('형식 오류는 400을 유지한다', async () => {
    const res = await POST(req({ email: 'not-an-email', password: '123' }));
    expect(res.status).toBe(400);
  });
});
