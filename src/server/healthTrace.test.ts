import { describe, expect, it } from 'vitest';
import { isHealthCheckSpan } from './healthTrace';

describe('isHealthCheckSpan', () => {
  it('health 경로의 요청 span을 가려낸다', () => {
    expect(isHealthCheckSpan('GET /api/health')).toBe(true);
    expect(isHealthCheckSpan('GET /api/health?probe=1')).toBe(true);
  });

  it('다른 경로와 경로 접두만 같은 요청은 가려내지 않는다', () => {
    expect(isHealthCheckSpan('GET /api/auth/me')).toBe(false);
    expect(isHealthCheckSpan('GET /api/healthz')).toBe(false);
    expect(isHealthCheckSpan('GET')).toBe(false);
  });
});
