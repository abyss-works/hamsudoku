import { describe, expect, it } from 'vitest';
import { createMemoryDb } from '../src/server/db';
import { backfillEndlessStats } from './backfill-endless-stats';

const stage = (id: string) => ({ id, size: 7, regions: '0'.repeat(49), solution: '0,0', tier: 2, seed: 1 });

describe('backfillEndlessStats', () => {
  it('dry-run은 DB를 변경하지 않고 복원 예정 값과 불일치를 보고한다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));
    // 과거 클리어 및 이벤트가 있지만 stage stats는 미갱신(0) 상태를 시뮬레이션
    await db.commitEndlessClear('u1', 'e-1', {
      earned: 3,
      season: '2026-W41',
      seedLeft: 3,
      elapsedMs: 25000,
      suspicious: false,
      atIso: '2026-10-07T00:00:00.000Z',
    });
    // 강제로 stage stats를 0으로 리셋하여 불일치 상태 조성
    await db.updateStageStats?.('e-1', { plays: 0, clears: 0, clearTotalMs: BigInt(0), avgClearMs: 0 });

    const report = await backfillEndlessStats(db, { dryRun: true });
    expect(report.ok).toBe(true);
    expect(report.dryRun).toBe(true);
    expect(report.updatedStages).toBe(1);

    // dry-run이므로 DB의 stage 값은 여전히 0이어야 한다
    const s = await db.getStage('e-1');
    expect(s?.clears).toBe(0);
    expect(s?.plays).toBe(0);
  });

  it('apply 모드는 DB에 plays, clears, clearTotalMs, avgClearMs를 복원한다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));
    await db.commitEndlessClear('u1', 'e-1', {
      earned: 3,
      season: '2026-W41',
      seedLeft: 3,
      elapsedMs: 20000,
      suspicious: false,
      atIso: '2026-10-07T00:00:00.000Z',
    });
    await db.commitEndlessClear('u2', 'e-1', {
      earned: 3,
      season: '2026-W41',
      seedLeft: 3,
      elapsedMs: 40000,
      suspicious: false,
      atIso: '2026-10-07T00:01:00.000Z',
    });
    // 강제로 0으로 리셋
    await db.updateStageStats?.('e-1', { plays: 0, clears: 0, clearTotalMs: BigInt(0), avgClearMs: 0 });

    const report = await backfillEndlessStats(db, { dryRun: false });
    expect(report.ok).toBe(true);
    expect(report.dryRun).toBe(false);
    expect(report.updatedStages).toBe(1);

    const s = await db.getStage('e-1');
    expect(s?.plays).toBe(2);
    expect(s?.clears).toBe(2);
    expect(s?.clearTotalMs).toEqual(BigInt(60000));
    expect(s?.avgClearMs).toBe(30000);
  });

  it('진행 기록에 클리어가 있으나 성공 이벤트가 없는 경우 보정을 차단하고 오류를 보고한다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-inconsistent'));
    // progress에 cleared=true가 있지만 EndlessEvent는 없는 비정상 데이터 주입
    await db.injectInconsistentProgress?.('u1', 'e-inconsistent', { cleared: true, attempts: 1 });

    const report = await backfillEndlessStats(db, { dryRun: false });
    expect(report.ok).toBe(false);
    expect(report.inconsistentStages).toBeGreaterThan(0);
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.errors[0]).toContain('e-inconsistent');

    // 비정상 판은 임의로 0이나 추측값으로 덮어쓰지 않아야 한다
    const s = await db.getStage('e-inconsistent');
    expect(s?.clears).toBe(0);
  });

  it('이미 복원된 데이터에 재실행해도 변경 수가 0이어야 한다 (반복 안전)', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));
    await db.commitEndlessClear('u1', 'e-1', {
      earned: 3,
      season: '2026-W41',
      seedLeft: 3,
      elapsedMs: 30000,
      suspicious: false,
      atIso: '2026-10-07T00:00:00.000Z',
    });

    const report1 = await backfillEndlessStats(db, { dryRun: false });
    expect(report1.ok).toBe(true);

    const report2 = await backfillEndlessStats(db, { dryRun: false });
    expect(report2.ok).toBe(true);
    expect(report2.updatedStages).toBe(0);
  });
});
