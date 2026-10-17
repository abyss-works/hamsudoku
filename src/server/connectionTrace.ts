import { subscribe, unsubscribe } from 'node:diagnostics_channel';

export interface AttributeTarget {
  setAttribute(key: string, value: number | string[]): unknown;
}

const CONNECTED = 'undici:client:connected';
const counts = new WeakMap<AttributeTarget, { total: number; hosts: string[] }>();

/** span에서 맺은 새 연결 수와 대상 호스트 목록을 누적해 속성으로 남긴다. */
export function recordNewConnection(span: AttributeTarget, host: string): void {
  const entry = counts.get(span) ?? { total: 0, hosts: [] };
  entry.total += 1;
  if (!entry.hosts.includes(host)) entry.hosts.push(host);
  counts.set(span, entry);
  span.setAttribute('http.new_connections', entry.total);
  span.setAttribute('http.new_connection_hosts', [...entry.hosts]);
}

/**
 * fetch(undici)가 새 소켓 연결을 맺을 때마다 진행 중인 span에 기록한다. 재사용된 연결은 이벤트가 없으므로
 * 요청 span의 새 연결 수로 keep-alive 재사용 여부를 판별한다. 반환한 함수는 구독을 해제한다.
 */
export function traceNewConnections(activeSpan: () => AttributeTarget | undefined): () => void {
  const onConnected = (message: unknown) => {
    const span = activeSpan();
    const host = (message as { connectParams?: { host?: string } }).connectParams?.host;
    if (span && host) recordNewConnection(span, host);
  };
  subscribe(CONNECTED, onConnected);
  return () => unsubscribe(CONNECTED, onConnected);
}
