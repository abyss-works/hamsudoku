// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resendSender } from './mail';

afterEach(() => vi.unstubAllGlobals());

const config = { apiKey: 'test-key', from: 'hamsudoku <no-reply@example.test>' };

describe('resendSender', () => {
  it('Resend HTTP API에 재설정 링크가 담긴 한국어 메일을 보낸다', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await resendSender(config).sendPasswordReset('a@example.com', 'https://app.test/api/auth/callback?token=t&x=1"');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ authorization: 'Bearer test-key' });
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ from: config.from, to: ['a@example.com'], subject: '[hamsudoku] 비밀번호 재설정' });
    expect(body.text).toContain('https://app.test/api/auth/callback?token=t&x=1"');
    expect(body.text).toContain('1시간 동안 유효합니다');
    expect(body.html).toContain('href="https://app.test/api/auth/callback?token=t&amp;x=1&quot;"');
  });

  it('Resend가 거절하면 상태 코드만 담은 오류를 던진다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"message":"secret detail"}', { status: 422 })));

    const sending = resendSender(config).sendPasswordReset('a@example.com', 'https://app.test/x');

    await expect(sending).rejects.toThrow('Resend rejected the mail: 422');
  });

  it('네트워크 오류는 그대로 전달한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));

    await expect(resendSender(config).sendPasswordReset('a@example.com', 'u')).rejects.toThrow('fetch failed');
  });
});
