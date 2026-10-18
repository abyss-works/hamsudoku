import { describe, expect, it } from 'vitest';
import { reportApiTiming } from './apiTimingReport';

describe('reportApiTiming', () => {
  it('API 응답 시간을 경로·브라우저 시간·서버 시간·앱 버전 속성의 로그로 남긴다', () => {
    const logs: unknown[] = [];
    const log = (message: string, attributes: unknown) => logs.push({ message, attributes });

    reportApiTiming({ path: '/api/endless/clear', durationMs: 152, serverMs: 83 }, '0.7.0', log);
    reportApiTiming({ path: '/api/auth/me', durationMs: 10, serverMs: null }, '0.7.0', log);

    expect(logs).toEqual([
      { message: 'API timing', attributes: { route: '/api/endless/clear', duration_ms: 152, server_ms: 83, app_version: '0.7.0' } },
      { message: 'API timing', attributes: { route: '/api/auth/me', duration_ms: 10, app_version: '0.7.0' } },
    ]);
  });
});
