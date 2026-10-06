import * as Sentry from '@sentry/nextjs';

// DSN이 없으면 SDK가 꺼진다. 로컬 개발은 DSN 없이 돌린다.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // 트래픽이 적어 전수 수집한다. 무료 한도(월 5M spans)에 닿으면 낮춘다.
  tracesSampleRate: 1.0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
