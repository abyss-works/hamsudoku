// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const created = vi.hoisted(() => ({ config: null as null | { secret: string; baseURL: string; executor: unknown; mail: { sendPasswordReset(to: string, url: string): Promise<void> } } }));
const logged = vi.hoisted(() => ({ errors: [] as { message: string; attributes: unknown }[] }));
const sendFailure = vi.hoisted(() => ({ error: null as Error | null }));

vi.mock('../db/client', () => ({ db: { marker: 'db' } }));
vi.mock('@sentry/nextjs', () => ({
  logger: { error: (message: string, attributes: unknown) => logged.errors.push({ message, attributes }) },
}));
vi.mock('./createAuth', () => ({
  createAuth: (config: NonNullable<typeof created.config>) => {
    created.config = config;
    return { marker: 'auth' };
  },
}));
vi.mock('./mail', () => ({
  resendSender: () => ({
    sendPasswordReset: async () => {
      if (sendFailure.error) throw sendFailure.error;
    },
  }),
}));

const ENV = {
  BETTER_AUTH_SECRET: 'secret-value',
  BETTER_AUTH_URL: 'https://app.test',
  RESEND_API_KEY: 'resend-key',
  MAIL_FROM: 'hamsudoku <no-reply@app.test>',
};

beforeEach(() => {
  vi.resetModules();
  created.config = null;
  logged.errors.length = 0;
  sendFailure.error = null;
  for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
});

afterEach(() => vi.unstubAllEnvs());

describe('isIdentityConfigured', () => {
  it('비밀값과 공개 주소가 모두 있어야 켜진다', async () => {
    const { isIdentityConfigured } = await import('./instance');
    expect(isIdentityConfigured()).toBe(true);

    vi.stubEnv('BETTER_AUTH_URL', '');
    expect(isIdentityConfigured()).toBe(false);
    vi.stubEnv('BETTER_AUTH_URL', ENV.BETTER_AUTH_URL);
    vi.stubEnv('BETTER_AUTH_SECRET', '');
    expect(isIdentityConfigured()).toBe(false);
  });
});

describe('appAuth', () => {
  it.each(Object.keys(ENV))('%s가 없으면 기본값 없이 변수 이름을 담아 실패한다', async (name) => {
    vi.stubEnv(name, '');
    const { appAuth } = await import('./instance');

    expect(() => appAuth()).toThrow(`Missing required environment variable: ${name}`);
    expect(created.config).toBeNull();
  });

  it('환경 변수와 전역 db로 인스턴스를 한 번만 만든다', async () => {
    const { appAuth } = await import('./instance');

    const first = appAuth();

    expect(created.config).toMatchObject({ secret: 'secret-value', baseURL: 'https://app.test', executor: { marker: 'db' } });
    created.config = null;
    expect(appAuth()).toBe(first);
    expect(created.config).toBeNull();
  });

  it('메일 발송이 실패하면 수신자 없이 사유만 기록하고 오류를 다시 던진다', async () => {
    const { appAuth } = await import('./instance');
    appAuth();
    sendFailure.error = new Error('Resend rejected the mail: 422');

    await expect(created.config!.mail.sendPasswordReset('private@example.com', 'https://app.test/x')).rejects.toThrow('422');

    expect(logged.errors).toEqual([{ message: 'Password reset mail failed', attributes: { reason: 'Resend rejected the mail: 422' } }]);
    expect(JSON.stringify(logged.errors)).not.toContain('private@example.com');
  });
});
