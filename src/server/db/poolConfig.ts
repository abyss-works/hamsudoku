import type { PoolConfig } from 'pg';

/** 상주 Node 프로세스가 쓰는 앱 DB 풀 설정. 유휴 연결은 30초 뒤 닫고, TCP keepalive로 끊긴 연결을 감지한다. */
export function appPoolConfig(connectionString: string | undefined): PoolConfig {
  return {
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    keepAlive: true,
  };
}
