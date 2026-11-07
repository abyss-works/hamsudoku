import { describe, expect, it } from 'vitest';
import { appPoolConfig } from './poolConfig';

describe('appPoolConfig', () => {
  it('장수명 프로세스 기준의 풀 설정을 반환한다', () => {
    expect(appPoolConfig('postgres://u:p@db/app')).toEqual({
      connectionString: 'postgres://u:p@db/app',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      keepAlive: true,
    });
  });

  it('접속 주소가 없으면 undefined를 그대로 전달한다', () => {
    expect(appPoolConfig(undefined).connectionString).toBeUndefined();
  });
});
