// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pull, pushClear } from './sync';
import type { ClearEntry } from './save';

afterEach(() => {
  vi.unstubAllGlobals();
});

const entry = (code: string, elapsed: number, at: string, attempts = 1): ClearEntry => ({
  stageCode: code,
  clearedAt: at,
  elapsedSec: elapsed,
  attempts,
});

describe('pull', () => {
  it('서버분을 로컬과 합쳐 덮어쓴다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ clears: [{ stageCode: '1-1', bestElapsedSec: 50, attempts: 2, lastClearedAt: 't9' }] }),
      ),
    );
    const merged = await pull([entry('1-1', 90, 't1')]);
    expect(merged.find((c) => c.stageCode === '1-1')).toMatchObject({ elapsedSec: 50, attempts: 3 });
  });
  it('서버가 죽으면 로컬을 그대로 둔다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('down');
      }),
    );
    const local = [entry('1-1', 90, 't1')];
    expect(await pull(local)).toEqual(local);
  });
});

describe('pushClear', () => {
  it('성공하면 true, 실패하면 false다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ok: true })));
    expect(await pushClear('1-1', 60, 'key-1')).toBe(true);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('down');
      }),
    );
    expect(await pushClear('1-1', 60, 'key-1')).toBe(false);
  });
});
