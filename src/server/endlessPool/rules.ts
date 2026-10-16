const MAX_INT32 = 2147483647;
const MAX_BIGINT64 = BigInt('9223372036854775807');

export interface StageStatsSource {
  stageId: string;
  totalAttempts: number;
  clearedUserCount: number;
  verifiedClearCount: number;
  verifiedClearTotalMs: bigint;
}

export interface StageStatsValues {
  plays: number;
  clears: number;
  clearTotalMs: bigint;
  avgClearMs: number;
}

/**
 * 진행 기록과 검증 이벤트로 판 통계의 목표 값을 만든다. 기록 사이에 모순이 있으면 추측으로 덮어쓰지 않도록
 * 불일치를 반환한다. 값은 컬럼 범위에서 멈추고 평균은 정수로 내림한다.
 */
export function stageStatsTarget(
  source: StageStatsSource,
): { ok: true; target: StageStatsValues } | { ok: false; error: string } {
  const { stageId, totalAttempts, clearedUserCount, verifiedClearCount, verifiedClearTotalMs } = source;
  if (clearedUserCount > 0 && verifiedClearCount === 0) {
    return {
      ok: false,
      error: `Stage ${stageId}: Inconsistent progress without verified clear events (cleared users: ${clearedUserCount}, verified events: 0). Backfill aborted to prevent data loss.`,
    };
  }
  if (clearedUserCount > verifiedClearCount) {
    return {
      ok: false,
      error: `Stage ${stageId}: Cleared user count (${clearedUserCount}) exceeds verified clear events (${verifiedClearCount}). Backfill aborted to prevent data loss.`,
    };
  }
  if (totalAttempts < verifiedClearCount) {
    return {
      ok: false,
      error: `Stage ${stageId}: Total attempts (${totalAttempts}) is less than verified clear count (${verifiedClearCount}). Backfill aborted to prevent data loss.`,
    };
  }
  const plays = Math.min(totalAttempts, MAX_INT32);
  const clears = Math.min(verifiedClearCount, MAX_INT32);
  const clearTotalMs = verifiedClearTotalMs > MAX_BIGINT64 ? MAX_BIGINT64 : verifiedClearTotalMs;
  const avgClearMs = clears > 0 ? Math.min(Number(clearTotalMs / BigInt(clears)), MAX_INT32) : 0;
  return { ok: true, target: { plays, clears, clearTotalMs, avgClearMs } };
}

export function sameStageStats(a: StageStatsValues, b: StageStatsValues): boolean {
  return a.plays === b.plays && a.clears === b.clears && a.clearTotalMs === b.clearTotalMs && a.avgClearMs === b.avgClearMs;
}
