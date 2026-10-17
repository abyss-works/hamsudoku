import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BackfillReport } from '../src/server/endlessPool/statsBackfill';
import { runBackfillCli } from './backfill-endless-stats';

const report = (overrides: Partial<BackfillReport> = {}): BackfillReport => ({
  ok: true,
  dryRun: true,
  totalStages: 1,
  scannedStages: 1,
  updatedStages: 0,
  inconsistentStages: 0,
  errors: [],
  ...overrides,
});

const ENV = { DATABASE_URL: 'postgresql://localhost/backfill-test' };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runBackfillCli', () => {
  it('인자가 없으면 dry-run으로 실행하고 성공 시 0을 반환한다', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const backfill = vi.fn(async () => report());
    expect(await runBackfillCli([], backfill, ENV)).toBe(0);
    expect(backfill).toHaveBeenCalledWith({ dryRun: true });
  });

  it('--apply이면 적용 모드로 실행한다', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const backfill = vi.fn(async () => report({ dryRun: false }));
    expect(await runBackfillCli(['--apply'], backfill, ENV)).toBe(0);
    expect(backfill).toHaveBeenCalledWith({ dryRun: false });
  });

  it('불일치가 있으면 오류를 출력하고 1을 반환한다', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const backfill = vi.fn(async () => report({ ok: false, inconsistentStages: 1, errors: ['Stage e-1: mismatch'] }));
    expect(await runBackfillCli(['--apply'], backfill, ENV)).toBe(1);
    expect(error).toHaveBeenCalledWith(' - Stage e-1: mismatch');
  });

  it('DATABASE_URL이 없으면 실행하지 않고 1을 반환한다', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const backfill = vi.fn(async () => report());
    expect(await runBackfillCli(['--apply'], backfill, {})).toBe(1);
    expect(backfill).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith('[backfill] DATABASE_URL이 없어 실행하지 않습니다.');
  });
});
