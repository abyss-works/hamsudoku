import { beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({
  captureException: vi.fn(),
  withMonitor: vi.fn((_slug: string, callback: () => unknown) => callback()),
}));
vi.mock('@sentry/nextjs', () => sentry);

import { captureJobFailure, DAILY_RANKING_MONITOR, monitorJob } from './jobMonitor';

beforeEach(() => {
  sentry.captureException.mockClear();
  sentry.withMonitor.mockClear();
});

describe('captureJobFailure', () => {
  it('작업 이름 태그와 함께 오류 이벤트를 남긴다', () => {
    const error = new Error('boom');
    captureJobFailure('play-audit', error);
    expect(sentry.captureException).toHaveBeenCalledWith(error, { tags: { 'job.name': 'play-audit' } });
  });
});

describe('monitorJob', () => {
  it('정의한 일정으로 체크인하며 작업 결과를 그대로 돌려준다', async () => {
    const result = await monitorJob(DAILY_RANKING_MONITOR, async () => 'done');

    expect(result).toBe('done');
    expect(sentry.withMonitor).toHaveBeenCalledWith('daily-ranking-recovery', expect.any(Function), {
      schedule: { type: 'crontab', value: '0 19 * * *' },
      checkinMargin: 30,
      maxRuntime: 5,
      timezone: 'Etc/UTC',
    });
  });
});
