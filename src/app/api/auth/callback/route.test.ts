import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { exchangeRecoveryCode } from '../../../../server/auth';

vi.mock('../../../../server/auth', () => ({ exchangeRecoveryCode: vi.fn() }));
afterEach(() => vi.clearAllMocks());

describe('복구 링크 HTTP 경계', () => {
  it('토큰 교환이 성공하면 비밀번호 설정 화면으로 이동한다', async () => {
    vi.mocked(exchangeRecoveryCode).mockResolvedValue(true);
    const res = await GET(new Request('https://example.com/api/auth/callback?token=recovery-token'));
    expect(res.headers.get('location')).toBe('https://example.com/?recovery=1');
    expect(exchangeRecoveryCode).toHaveBeenCalledWith('recovery-token');
  });
  it('교환 실패와 token 누락은 복구 오류 화면으로 이동한다', async () => {
    vi.mocked(exchangeRecoveryCode).mockResolvedValue(false);
    const res = await GET(new Request('https://example.com/api/auth/callback?token=bad'));
    expect(res.headers.get('location')).toBe('https://example.com/?recovery=error');
    vi.mocked(exchangeRecoveryCode).mockClear();
    const missing = await GET(new Request('https://example.com/api/auth/callback'));
    expect(missing.headers.get('location')).toBe('https://example.com/?recovery=error');
    expect(exchangeRecoveryCode).not.toHaveBeenCalled();
  });
  it('이동 주소의 origin은 요청이 아니라 BETTER_AUTH_URL을 따른다', async () => {
    vi.stubEnv('BETTER_AUTH_URL', 'https://hamsudoku.abyssworks.dev');
    vi.mocked(exchangeRecoveryCode).mockResolvedValue(true);
    const res = await GET(new Request('http://internal-pod:3000/api/auth/callback?token=t'));
    expect(res.headers.get('location')).toBe('https://hamsudoku.abyssworks.dev/?recovery=1');
    vi.unstubAllEnvs();
  });
});
