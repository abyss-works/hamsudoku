import * as Sentry from '@sentry/nextjs';

// edge 런타임 라우트가 없어 nodejs 설정만 둔다.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
