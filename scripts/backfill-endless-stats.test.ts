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

  it('일부 스테이지만 불일치해도 쓰기 전에 전체 검사를 완료하여 부분 안전하지 않은 보정(partial update)을 차단한다', async () => {
    const db = createMemoryDb();
    // stage 1: 정상적인 보정 대상 (stats 0 리셋)
    await db.insertStage(stage('e-valid'));
    await db.commitEndlessClear('u1', 'e-valid', {
      earned: 3,
      season: '2026-W41',
      seedLeft: 3,
      elapsedMs: 20000,
      suspicious: false,
      atIso: '2026-10-07T00:00:00.000Z',
    });
    await db.updateStageStats?.('e-valid', { plays: 0, clears: 0, clearTotalMs: BigInt(0), avgClearMs: 0 });

    // stage 2: 불일치 대상 (clearedUserCount: 2 > verifiedClearCount: 1)
    await db.insertStage(stage('e-partial-inconsistent'));
    await db.commitEndlessClear('u1', 'e-partial-inconsistent', {
      earned: 3,
      season: '2026-W41',
      seedLeft: 3,
      elapsedMs: 20000,
      suspicious: false,
      atIso: '2026-10-07T00:00:00.000Z',
    });
    // u2에 대해 progress만 클리어 주입하여 이벤트 수량(1)보다 유저 수량(2)이 많게 만듦
    await db.injectInconsistentProgress?.('u2', 'e-partial-inconsistent', { cleared: true, attempts: 1 });

    const report = await backfillEndlessStats(db, { dryRun: false });
    expect(report.ok).toBe(false);
    expect(report.inconsistentStages).toBeGreaterThan(0);

    // 전체 검사 실패로 인해 정상 stage인 e-valid조차 수정되지 않고 즉시 중단되어야 함
    const validStage = await db.getStage('e-valid');
    expect(validStage?.clears).toBe(0);
    expect(validStage?.plays).toBe(0);
  });

  it('runBackfillCli는 CLI 플래그를 파싱하고 exitcode를 반환하며 dry-run 기본 동작을 유지한다', async () => {
    const { runBackfillCli } = await import('./backfill-endless-stats');
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
    await db.updateStageStats?.('e-1', { plays: 0, clears: 0, clearTotalMs: BigInt(0), avgClearMs: 0 });

    // 인자 없음: dry-run 기본 동작, exitcode 0, DB 미수정
    const codeDry = await runBackfillCli([], db);
    expect(codeDry).toBe(0);
    const sDry = await db.getStage('e-1');
    expect(sDry?.clears).toBe(0);

    // --apply 플래그: exitcode 0, DB 실제 수정
    const codeApply = await runBackfillCli(['--apply'], db);
    expect(codeApply).toBe(0);
    const sApply = await db.getStage('e-1');
    expect(sApply?.clears).toBe(1);

    // 불일치 DB에 대해 실행 시 exitcode 1 반환
    await db.injectInconsistentProgress?.('u2', 'e-1', { cleared: true, attempts: 1 });
    const codeErr = await runBackfillCli(['--apply'], db);
    expect(codeErr).toBe(1);
  });
});

