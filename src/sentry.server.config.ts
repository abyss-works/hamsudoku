import * as Sentry from '@sentry/nextjs';

// Prisma 6 쿼리 span과 바깥 fetch span(Supabase Auth)은 기본 통합이 수집한다.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
});
