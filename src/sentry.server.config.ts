import * as Sentry from '@sentry/nextjs';

// Prisma 6 쿼리 span과 바깥 fetch span(Supabase Auth)은 기본 통합이 수집한다.
// 구조화 로그(Sentry.logger)는 기본 활성화되어 있어 별도 옵션이 필요 없다.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
});
