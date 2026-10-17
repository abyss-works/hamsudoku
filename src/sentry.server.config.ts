import * as Sentry from '@sentry/nextjs';
import { traceNewConnections } from './server/connectionTrace';
import { scrubDatabaseErrorEvent } from './server/db/errors';

// node-postgres 쿼리 span과 바깥 fetch span(Supabase Auth)은 기본 통합이 수집한다.
// 구조화 로그(Sentry.logger)는 기본 활성화되어 있어 별도 옵션이 필요 없다.
// 쿼리 빌더 오류 메시지에 실린 쿼리 인자(사용자 식별자 등)는 전송 전에 가린다.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  beforeSend: (event) => scrubDatabaseErrorEvent(event),
});

// 요청마다 외부 HTTP 호출이 새로 맺은 연결 수를 요청 span에 남긴다.
traceNewConnections(() => {
  const span = Sentry.getActiveSpan();
  return span ? Sentry.getRootSpan(span) : undefined;
});
