import { describe, expect, it } from 'vitest';
import { createMemoryDb } from './db';
import { finalizeSeason, getFinalizedSeasonRank } from './seasonFinalization';

describe('시즌 집계와 영속화 (Step 1)', () => {
  const stage = (id: string) => ({ id, size: 7, regions: '0'.repeat(49), solution: '0,0', tier: 2, seed: 1 });

  it('종료 경계: 23:59:59 KST 획득은 포함되고 00:00:00 KST 획득은 마감 시즌에서 제외된다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));
    await db.insertStage(stage('e-2'));

    // W41 집계 구간: 2026-10-04T19:00:00.000Z (월 04:00 KST) ~ 2026-10-11T15:00:00.000Z (다음 월 00:00 KST)
    // 마감 1초 전 (2026-10-11T14:59:59.000Z)
    await db.commitEndlessClear('user-before', 'e-1', {
      earned: 3,
      season: '2026-W41',
      seedLeft: 3,
      elapsedMs: 15000,
      suspicious: false,
      atIso: '2026-10-11T14:59:59.000Z',
    });

    // 마감 정각 (2026-10-11T15:00:00.000Z = 월 00:00 KST)
    await db.commitEndlessClear('user-after', 'e-2', {
      earned: 3,
      season: '2026-W41',
      seedLeft: 3,
      elapsedMs: 15000,
      suspicious: false,
      atIso: '2026-10-11T15:00:00.000Z',
    });

    const finalized = await finalizeSeason(db, '2026-W41', new Date('2026-10-11T15:01:00.000Z'));
    expect(finalized.results.find((r) => r.userId === 'user-before')?.score).toBe(3);
    expect(finalized.results.find((r) => r.userId === 'user-after')).toBeUndefined();
  });

  it('00~04시 제외: 마감 창 획득은 지갑에는 남지만 주간 랭킹 집계에서는 제외된다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));
    await db.insertStage(stage('e-2'));

    // 마감 창 내부: 월 02:00 KST (2026-10-11T17:00:00.000Z)
    const clearResult = await db.commitEndlessClear('user-freeze', 'e-1', {
      earned: 3,
      season: '2026-W41',
      seedLeft: 3,
      elapsedMs: 15000,
      suspicious: false,
      atIso: '2026-10-11T17:00:00.000Z',
    });
    // 지갑 잔액에는 정상 반영
    expect(clearResult.balance).toBe(3);

    // W41 확정 시 마감 창 획득은 제외됨
    const finalizedW41 = await finalizeSeason(db, '2026-W41', new Date('2026-10-11T18:00:00.000Z'));
    expect(finalizedW41.results.find((r) => r.userId === 'user-freeze')).toBeUndefined();

    // W42 개시 후(월 04:00 KST = 2026-10-11T19:00:00.000Z) 정상 획득
    await db.commitEndlessClear('user-next', 'e-2', {
      earned: 2,
      season: '2026-W42',
      seedLeft: 2,
      elapsedMs: 15000,
      suspicious: false,
      atIso: '2026-10-11T19:05:00.000Z',
    });
    // W42 집계 시에는 마감 창의 user-freeze는 W42에도 포함되지 않음
    const finalizedW42 = await finalizeSeason(db, '2026-W42', new Date('2026-10-18T16:00:00.000Z'));
    expect(finalizedW42.results.find((r) => r.userId === 'user-freeze')).toBeUndefined();
    expect(finalizedW42.results.find((r) => r.userId === 'user-next')?.score).toBe(2);
  });

  it('동점: 점수 내림차순, userId 내림차순으로 결정하며 1-based 순위를 매긴다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));

    await db.commitEndlessClear('user-alpha', 'e-1', {
      earned: 3,
      season: '2026-W41',
      seedLeft: 3,
      elapsedMs: 15000,
      suspicious: false,
      atIso: '2026-10-06T10:00:00.000Z',
    });
    await db.commitEndlessClear('user-beta', 'e-1', {
      earned: 3,
      season: '2026-W41',
      seedLeft: 3,
      elapsedMs: 15000,
      suspicious: false,
      atIso: '2026-10-06T11:00:00.000Z',
    });
    await db.commitEndlessClear('user-gamma', 'e-1', {
      earned: 5,
      season: '2026-W41',
      seedLeft: 3,
      elapsedMs: 15000,
      suspicious: false,
      atIso: '2026-10-06T12:00:00.000Z',
    });

    const finalized = await finalizeSeason(db, '2026-W41', new Date('2026-10-11T16:00:00.000Z'));
    // 점수: gamma(5), beta(3), alpha(3)
    // beta > alpha 이므로 beta가 2위, alpha가 3위
    expect(finalized.results.map((r) => ({ userId: r.userId, rank: r.rank, score: r.score }))).toEqual([
      { userId: 'user-gamma', rank: 1, score: 5 },
      { userId: 'user-beta', rank: 2, score: 3 },
      { userId: 'user-alpha', rank: 3, score: 3 },
    ]);
  });

  it('전체 참여자: 상위 50명에 한정하지 않고 전체 참여자의 결과를 보관한다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));

    for (let i = 1; i <= 60; i += 1) {
      const uid = `user-${String(i).padStart(3, '0')}`;
      await db.commitEndlessClear(uid, 'e-1', {
        earned: i,
        season: '2026-W41',
        seedLeft: 3,
        elapsedMs: 15000,
        suspicious: false,
        atIso: '2026-10-06T10:00:00.000Z',
      });
    }

    const finalized = await finalizeSeason(db, '2026-W41', new Date('2026-10-11T16:00:00.000Z'));
    expect(finalized.results).toHaveLength(60);
    expect(finalized.results[0]).toMatchObject({ userId: 'user-060', rank: 1, score: 60 });
    expect(finalized.results[59]).toMatchObject({ userId: 'user-001', rank: 60, score: 1 });
  });

  it('중복 확정: 재실행 시 기존 확정 결과를 멱등하게 반환한다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));
    await db.commitEndlessClear('user-1', 'e-1', {
      earned: 3,
      season: '2026-W41',
      seedLeft: 3,
      elapsedMs: 15000,
      suspicious: false,
      atIso: '2026-10-06T10:00:00.000Z',
    });

    const first = await finalizeSeason(db, '2026-W41', new Date('2026-10-11T16:00:00.000Z'));
    const second = await finalizeSeason(db, '2026-W41', new Date('2026-10-11T17:00:00.000Z'));

    expect(second.header.finalizedAt).toBe(first.header.finalizedAt);
    expect(second.results).toEqual(first.results);

    const queried = await getFinalizedSeasonRank(db, '2026-W41');
    expect(queried).toEqual(first);
  });

  it('처리 중 제출 경쟁: 마감 이전 승인된 쓰기가 직렬화되어 누락되지 않고, 확정 후 이전 시즌 적립은 제외된다', async () => {
    const db = createMemoryDb();
    await db.insertStage(stage('e-1'));

    // 처리 중 지연 쓰기 모사
    let resolveWrite: () => void = () => {};
    const writeGate = new Promise<void>((r) => {
      resolveWrite = r;
    });

    const inFlightWrite = db.commitEndlessClear('user-inflight', 'e-1', {
      earned: 3,
      season: '2026-W41',
      seedLeft: 3,
      elapsedMs: 15000,
      suspicious: false,
      atIso: '2026-10-11T14:59:58.000Z',
      delayBeforeCommit: writeGate,
    });

    // 확정 실행 시도 (in-flight 쓰기가 직렬화 잠금을 쥐고 있으므로 대기해야 함)
    const finalizePromise = finalizeSeason(db, '2026-W41', new Date('2026-10-11T15:00:05.000Z'));

    // in-flight 쓰기 해제 및 완료
    resolveWrite();
    await inFlightWrite;

    const finalized = await finalizePromise;
    expect(finalized.results.find((r) => r.userId === 'user-inflight')?.score).toBe(3);

    // 확정 이후 뒤늦게 제출된 이전 시즌 적립
    await db.commitEndlessClear('user-late', 'e-1', {
      earned: 3,
      season: '2026-W41',
      seedLeft: 3,
      elapsedMs: 15000,
      suspicious: false,
      atIso: '2026-10-11T14:59:50.000Z',
    });

    // 이미 확정된 시즌에는 재확정 또는 조회를 하더라도 늦은 제출이 소급 포함되지 않는다
    const rechecked = await getFinalizedSeasonRank(db, '2026-W41');
    expect(rechecked?.results.find((r) => r.userId === 'user-late')).toBeUndefined();
  });

});
