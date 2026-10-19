import { describe, expect, it, vi } from 'vitest';
import { isDatabaseAvailable } from './health';
import { checkConnection } from './db/client';

vi.mock('./db/client', () => ({ checkConnection: vi.fn(async () => undefined) }));

describe('isDatabaseAvailable', () => {
  it('연결 확인이 성공하면 true를 반환한다', async () => {
    expect(await isDatabaseAvailable()).toBe(true);
  });

  it('연결 확인이 실패하면 false를 반환한다', async () => {
    vi.mocked(checkConnection).mockRejectedValueOnce(new Error('connection refused'));

    expect(await isDatabaseAvailable()).toBe(false);
  });
});
