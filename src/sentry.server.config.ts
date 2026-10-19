import * as Sentry from '@sentry/nextjs';
import { traceNewConnections } from './server/connectionTrace';
import { scrubDatabaseErrorEvent } from './server/db/errors';
import { isHealthCheckSpan } from './server/healthTrace';
import { createInstanceTracker } from './server/instanceTrace';
import { collectSpanTimings } from './server/serverTiming';

// node-postgres 쿼리 span과 바깥 fetch span(Supabase Auth)은 기본 통합이 수집한다.
// 구조화 로그(Sentry.logger)는 기본 활성화되어 있어 별도 옵션이 필요 없다.
// 쿼리 빌더 오류 메시지에 실린 쿼리 인자(사용자 식별자 등)는 전송 전에 가린다.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // 가용성 감시 요청은 분마다 들어오므로 트레이스를 남기지 않는다.
  tracesSampler: ({ name, inheritOrSampleWith }) => (isHealthCheckSpan(name) ? 0 : inheritOrSampleWith(1.0)),
  initialScope: { tags: { 'app.version': process.env.APP_VERSION ?? 'unknown' } },
  beforeSend: (event) => scrubDatabaseErrorEvent(event),
});

// 요청마다 외부 HTTP 호출이 새로 맺은 연결 수를 요청 span에 남긴다.
traceNewConnections(() => {
  const span = Sentry.getActiveSpan();
  return span ? Sentry.getRootSpan(span) : undefined;
});

// API 응답의 Server-Timing 헤더에 쓸 DB·외부 호출 시간을 요청별로 합산한다.
collectSpanTimings();

// 요청 루트 span에 인스턴스 안 요청 순번과 경과 시간을 남겨 콜드·웜 요청을 구분한다.
const instance = createInstanceTracker(() => performance.now());
Sentry.getClient()?.on('spanStart', (span) => {
  if (Sentry.getRootSpan(span) === span) instance.onRootSpanStart(span);
});
