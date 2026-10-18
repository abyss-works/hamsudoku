import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { watchApiTimings, type ApiTiming } from '../../platform/timing/apiTiming';

type Log = (message: string, attributes: Record<string, string | number>) => void;

/** API 응답 시간 하나를 경로·브라우저 시간·서버 시간·앱 버전 속성의 구조화 로그로 남긴다. */
export function reportApiTiming(timing: ApiTiming, appVersion: string, log: Log): void {
  log('API timing', {
    route: timing.path,
    duration_ms: timing.durationMs,
    ...(timing.serverMs === null ? {} : { server_ms: timing.serverMs }),
    app_version: appVersion,
  });
}

/** 브라우저의 모든 API 응답 시간을 Sentry 로그로 보내기 시작한다. 반환한 함수는 관찰을 멈춘다. */
export function startApiTimingReport(): () => void {
  const appVersion = process.env.APP_VERSION ?? 'unknown';
  return watchApiTimings((timing) => reportApiTiming(timing, appVersion, (message, attributes) => Sentry.logger.info(message, attributes)));
}

/** 호출한 컴포넌트가 마운트된 동안 API 응답 시간을 보고한다. */
export function useApiTimingReport(): void {
  useEffect(() => startApiTimingReport(), []);
}
