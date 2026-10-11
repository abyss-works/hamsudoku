import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRetryJob } from './endlessRetryJob';

describe('endlessRetryJob', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('지정된 시간이 지나면 resolve된다', async () => {
    const job = createRetryJob(3000);
    let resolved = false;
    void job.promise.then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(2999);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(resolved).toBe(true);
  });

  it('cancel() 호출 시 타이머를 정리하고 즉시 resolve된다', async () => {
    const job = createRetryJob(3000);
    let resolved = false;
    void job.promise.then(() => {
      resolved = true;
    });

    expect(vi.getTimerCount()).toBe(1);
    job.cancel();
    expect(vi.getTimerCount()).toBe(0);
    await Promise.resolve();
    expect(resolved).toBe(true);
  });
});
