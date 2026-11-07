// 환경 변수로 조립한 앱의 인증 인스턴스. 필수 환경 변수가 없으면 기본값 없이 실패한다.
import * as Sentry from '@sentry/nextjs';
import { db } from '../db/client';
import { createAuth, type Auth } from './createAuth';
import { resendSender, type MailSender } from './mail';

const REQUIRED = ['BETTER_AUTH_SECRET', 'BETTER_AUTH_URL', 'RESEND_API_KEY', 'MAIL_FROM'] as const;

/** 인증을 켜는 기준. 두 값이 없으면 서버 인증이 꺼진 환경으로 보고 클라이언트는 로컬 계정으로 동작한다. */
export function isIdentityConfigured(): boolean {
  return Boolean(process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_URL);
}

function requiredEnv(): Record<(typeof REQUIRED)[number], string> {
  const values = {} as Record<(typeof REQUIRED)[number], string>;
  for (const name of REQUIRED) {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    values[name] = value;
  }
  return values;
}

/** 발송 실패는 수신자 없이 사유만 기록하고 호출자에게 다시 던진다. */
function loggedMail(mail: MailSender): MailSender {
  return {
    async sendPasswordReset(to, url) {
      try {
        await mail.sendPasswordReset(to, url);
      } catch (error) {
        Sentry.logger.error('Password reset mail failed', { reason: error instanceof Error ? error.message : 'unknown' });
        throw error;
      }
    },
  };
}

let instance: Auth | undefined;

/** 프로세스마다 한 번 만든다. */
export function appAuth(): Auth {
  if (instance) return instance;
  const env = requiredEnv();
  instance = createAuth({
    executor: db,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    mail: loggedMail(resendSender({ apiKey: env.RESEND_API_KEY, from: env.MAIL_FROM })),
  });
  return instance;
}
