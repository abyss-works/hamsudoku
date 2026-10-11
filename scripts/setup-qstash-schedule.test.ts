import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run } from './setup-qstash-schedule';

describe('setup-qstash-schedule CLI (결함 4)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('APP_URL이 누락되었을 때 production URL 기본값을 사용하지 않고 명시적으로 실패한다', async () => {
    delete process.env.APP_URL;

    await expect(run([])).rejects.toThrow('APP_URL');
  });

  it('APP_URL이 제공되었을 때 dry-run 모드에서 해당 URL 엔드포인트를 올바르게 구성한다', async () => {
    process.env.APP_URL = 'http://staging.hamsudoku.dev';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(run([])).resolves.toBeUndefined();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('http://staging.hamsudoku.dev/api/internal/ranking-finalize'));
  });
});
