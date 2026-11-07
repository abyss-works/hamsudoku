// 인증 구성. Better Auth 인스턴스를 만든다. 데이터베이스 실행 객체와 메일 발송기를 받아 환경과 무관하게 조립한다.
import { betterAuth } from 'better-auth';
import { anonymous } from 'better-auth/plugins';
import { randomUUID } from 'node:crypto';
import type { Executor } from '../db/client';
import type { MailSender } from './mail';
import { passwordRecovery } from './recovery';
import {
  ANONYMOUS_EMAIL_DOMAIN,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  RESET_PASSWORD_EXPIRES_IN,
  SESSION_EXPIRES_IN,
  bcryptPassword,
} from './rules';
import { authAdapter } from './store';
import { anonymousUpgrade } from './upgrade';

export interface IdentityConfig {
  executor: Executor;
  secret: string;
  /** 앱의 공개 주소. 예: https://hamsudoku.abyssworks.dev */
  baseURL: string;
  mail: MailSender;
}

/** 재설정 메일 링크. 앱의 재설정 착지 경로에 토큰을 싣는다. */
export function recoveryLink(baseURL: string, token: string): string {
  const url = new URL('/api/auth/callback', baseURL);
  url.searchParams.set('token', token);
  return url.href;
}

export function createAuth(config: IdentityConfig) {
  return betterAuth({
    database: authAdapter(config.executor),
    secret: config.secret,
    baseURL: config.baseURL,
    basePath: '/api/auth',
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      password: bcryptPassword,
      sendResetPassword: ({ user, token }) => config.mail.sendPasswordReset(user.email, recoveryLink(config.baseURL, token)),
      resetPasswordTokenExpiresIn: RESET_PASSWORD_EXPIRES_IN,
      revokeSessionsOnPasswordReset: true,
    },
    session: { expiresIn: SESSION_EXPIRES_IN },
    // 사용자 id는 기존 인증 서버와 같은 UUID 문자열 형식이다.
    advanced: { database: { generateId: () => randomUUID() } },
    plugins: [
      anonymous({
        // 다른 계정으로 로그인해도 게스트 계정과 진행을 지우지 않는다.
        disableDeleteAnonymousUser: true,
        generateRandomEmail: () => `${randomUUID()}@${ANONYMOUS_EMAIL_DOMAIN}`,
      }),
      anonymousUpgrade(),
      passwordRecovery(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
