import { beforeEach, describe, expect, it, vi } from 'vitest';

const logs = vi.hoisted(() => [] as { level: string; message: string; attributes: unknown }[]);
vi.mock('@sentry/nextjs', () => ({
  logger: {
    info: (message: string, attributes: unknown) => logs.push({ level: 'info', message, attributes }),
    warn: (message: string, attributes: unknown) => logs.push({ level: 'warn', message, attributes }),
  },
}));

import { deferTask, type Defer } from './defer';

function collect(): { defer: Defer; run: () => Promise<void> } {
  const tasks: (() => Promise<void>)[] = [];
  return { defer: (task) => void tasks.push(task), run: async () => { for (const t of tasks) await t(); } };
}

beforeEach(() => {
  logs.length = 0;
});

describe('deferTask', () => {
  it('성공한 작업의 이름과 소요 시간을 info 로그로 남긴다', async () => {
    const clock = [100, 112.6];
    const { defer, run } = collect();
    deferTask(defer, { name: 'rank-earning', task: async () => {}, onError: () => {} }, () => clock.shift() ?? 0);

    await run();

    expect(logs).toEqual([{ level: 'info', message: 'After task', attributes: { task: 'rank-earning', ok: true, duration_ms: 13 } }]);
  });

  it('실패한 작업은 onError로 넘기고 warn 로그를 남기며 예외를 밖으로 던지지 않는다', async () => {
    const clock = [0, 5];
    const errors: unknown[] = [];
    const { defer, run } = collect();
    const failure = new Error('boom');
    deferTask(
      defer,
      { name: 'play-log', task: async () => { throw failure; }, onError: (error) => errors.push(error) },
      () => clock.shift() ?? 0,
    );

    await expect(run()).resolves.toBeUndefined();
    expect(errors).toEqual([failure]);
    expect(logs).toEqual([{ level: 'warn', message: 'After task', attributes: { task: 'play-log', ok: false, duration_ms: 5 } }]);
  });
});
