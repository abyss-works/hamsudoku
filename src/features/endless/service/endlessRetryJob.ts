export interface RetryJob {
  promise: Promise<void>;
  cancel(): void;
}

export function createRetryJob(delayMs: number): RetryJob {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let resolveFn: (() => void) | null = null;

  const promise = new Promise<void>((resolve) => {
    resolveFn = resolve;
    timer = setTimeout(() => {
      timer = null;
      resolveFn = null;
      resolve();
    }, delayMs);
  });

  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (resolveFn !== null) {
      resolveFn();
      resolveFn = null;
    }
  };

  return { promise, cancel };
}
