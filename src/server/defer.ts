import * as Sentry from '@sentry/nextjs';

/** 응답 뒤에 실행할 작업을 받는 함수. route handler는 Next.js after를 전달하고 테스트는 작업을 모은다. */
export type Defer = (task: () => Promise<void>) => void;

export interface DeferredTask {
  /** 로그에 남길 작업 이름. */
  name: string;
  task: () => Promise<unknown>;
  /** 작업이 실패했을 때의 정리와 기록. 응답과 다른 작업에 영향을 주지 않는다. */
  onError: (error: unknown) => void;
}

/**
 * 작업을 응답 뒤로 미루고, 끝나면 작업 이름·성공 여부·소요 시간을 구조화 로그로 남긴다.
 * 응답 뒤 작업은 요청 span과 Server-Timing 밖에서 실행되므로 이 로그로 관측한다. 실패는 밖으로 던지지 않는다.
 */
export function deferTask(defer: Defer, { name, task, onError }: DeferredTask, now: () => number = () => performance.now()): void {
  defer(async () => {
    const start = now();
    try {
      await task();
      Sentry.logger.info('After task', { task: name, ok: true, duration_ms: Math.round(now() - start) });
    } catch (error) {
      onError(error);
      Sentry.logger.warn('After task', { task: name, ok: false, duration_ms: Math.round(now() - start) });
    }
  });
}
