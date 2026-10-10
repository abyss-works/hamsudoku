import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { exchangeRecoveryCode } from '../../../../server/auth';

vi.mock('../../../../server/auth', () => ({ exchangeRecoveryCode: vi.fn() }));
afterEach(() => vi.clearAllMocks());

describe('복구 링크 HTTP 경계', () => {
  it('세션 교환이 성공하면 비밀번호 설정 화면으로 이동한다', async () => {
    vi.mocked(exchangeRecoveryCode).mockResolvedValue(true);
    const res = await GET(new Request('https://example.com/api/auth/callback?code=recovery-code'));
    expect(res.headers.get('location')).toBe('https://example.com/?recovery=1');
    expect(exchangeRecoveryCode).toHaveBeenCalledWith('recovery-code');
  });
  it('교환 실패와 code 누락은 복구 오류 화면으로 이동한다', async () => {
    vi.mocked(exchangeRecoveryCode).mockResolvedValue(false);
    const res = await GET(new Request('https://example.com/api/auth/callback?code=bad'));
    expect(res.headers.get('location')).toBe('https://example.com/?recovery=error');
    vi.mocked(exchangeRecoveryCode).mockClear();
    const missing = await GET(new Request('https://example.com/api/auth/callback'));
    expect(missing.headers.get('location')).toBe('https://example.com/?recovery=error');
    expect(exchangeRecoveryCode).not.toHaveBeenCalled();
  });
});
