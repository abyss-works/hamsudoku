/** 외부 가용성 감시가 호출하는 경로. */
const HEALTH_CHECK_PATH = '/api/health';

/** 요청 span 이름(`{method} {path}`)이 가용성 감시 요청인지 판정한다. */
export function isHealthCheckSpan(name: string): boolean {
  const path = name.split(' ')[1]?.split('?')[0];
  return path === HEALTH_CHECK_PATH;
}
