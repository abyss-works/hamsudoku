import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const qstash = vi.hoisted(() => ({ created: [] as Record<string, unknown>[] }));
vi.mock('@upstash/qstash', () => ({
  Client: vi.fn(function () {
    return {
      schedules: {
        create: async (input: Record<string, unknown>) => {
          qstash.created.push(input);
          return { scheduleId: `schedule-${qstash.created.length}` };
        },
      },
    };
  }),
}));

import { run, SCHEDULE_DEFINITIONS } from './setup-qstash-schedule';

describe('setup-qstash-schedule CLI (결함 4)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    qstash.created.length = 0;
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
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('http://staging.hamsudoku.dev/api/internal/play-audit'));
    expect(qstash.created).toEqual([]);
  });

  it('플레이 기록 감사를 매일 19:30 UTC에 실행하는 스케줄을 정의한다', () => {
    expect(SCHEDULE_DEFINITIONS.map((def) => [def.name, def.path, def.cron])).toEqual([
      ['weekly-ranking-finalize', '/api/internal/ranking-finalize', '5 15 * * 0'],
      ['daily-ranking-catchup', '/api/internal/ranking-finalize', '0 19 * * *'],
      ['daily-play-audit', '/api/internal/play-audit', '30 19 * * *'],
    ]);
  });

  it('--execute는 스케줄마다 정의한 경로로 등록한다', async () => {
    process.env.APP_URL = 'http://staging.hamsudoku.dev/';
    process.env.QSTASH_TOKEN = 'test-token';
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await run(['--execute']);

    expect(qstash.created.map((input) => [input.destination, input.cron, input.body])).toEqual([
      ['http://staging.hamsudoku.dev/api/internal/ranking-finalize', '5 15 * * 0', '{"recover":true}'],
      ['http://staging.hamsudoku.dev/api/internal/ranking-finalize', '0 19 * * *', '{"recover":true}'],
      ['http://staging.hamsudoku.dev/api/internal/play-audit', '30 19 * * *', '{}'],
    ]);
  });
});
