import * as Sentry from '@sentry/nextjs';

export interface JobMonitor {
  slug: string;
  /** 예약 cron 식(UTC). */
  crontab: string;
}

/** 일일 미확정 시즌 복구 예약(매일 19:00 UTC). 주간 확정 예약도 같은 복구를 실행해 체크인한다. */
export const DAILY_RANKING_MONITOR: JobMonitor = { slug: 'daily-ranking-recovery', crontab: '0 19 * * *' };

/** 내부 예약 작업의 실패를 작업 이름 태그와 함께 오류 이벤트로 남긴다. */
export function captureJobFailure(job: string, error: unknown): void {
  Sentry.captureException(error, { tags: { 'job.name': job } });
}

/**
 * 예약 작업을 Sentry cron 모니터로 감싼다. 예정 시각에 체크인이 없거나 작업이 실패·초과하면 모니터가 이를 표시한다.
 * 작업의 결과와 예외는 그대로 전달한다.
 */
export function monitorJob<T>(monitor: JobMonitor, job: () => Promise<T>): Promise<T> {
  return Sentry.withMonitor(monitor.slug, job, {
    schedule: { type: 'crontab', value: monitor.crontab },
    checkinMargin: 30,
    maxRuntime: 5,
    timezone: 'Etc/UTC',
  });
}
