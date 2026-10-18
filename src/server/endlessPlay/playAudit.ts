import { db } from '../db/client';
import { describeDbError } from '../db/errors';
import { captureJobFailure } from '../jobMonitor';
import { findUnauditedPlayLogs } from './queries';
import { auditPlayLog, type PlayAuditFlag } from './rules';
import { saveAudits } from './store';

/** 감사 1회에 처리하는 기록 수의 상한. */
export const AUDIT_BATCH_LIMIT = 500;

/**
 * 미감사 플레이 기록을 판 정답과 대조해 감사 결과를 저장하고 처리 건수, 이상 항목이 있는 건수, 플래그별 건수를 반환한다.
 * 저장 시각이 오래된 기록부터 상한까지 처리한다. 결과는 관측용이며 보상과 제출 상태를 바꾸지 않는다.
 */
export async function auditPlayLogs(
  now: Date,
  limit: number = AUDIT_BATCH_LIMIT,
): Promise<{ audited: number; flagged: number; flagCounts: Partial<Record<PlayAuditFlag, number>> }> {
  const pending = await findUnauditedPlayLogs(db, limit);
  const audits = pending.map((row) => ({
    attemptId: row.attemptId,
    audit: auditPlayLog({
      events: row.events,
      solution: row.solution,
      outcome: row.outcome,
      claimedSeedLeft: row.claimedSeedLeft,
      serverElapsedMs: row.serverElapsedMs,
    }),
  }));
  const saved = new Set(await saveAudits(db, audits, now));
  const savedAudits = audits.filter((entry) => saved.has(entry.attemptId));
  const flagCounts: Partial<Record<PlayAuditFlag, number>> = {};
  for (const flag of savedAudits.flatMap((entry) => entry.audit.flags)) flagCounts[flag] = (flagCounts[flag] ?? 0) + 1;
  return {
    audited: saved.size,
    flagged: savedAudits.filter((entry) => entry.audit.flags.length > 0).length,
    flagCounts,
  };
}

/** 감사 실패를 기록 원문 없이 오류 요약으로 남긴다. */
export function reportAuditFailure(error: unknown): void {
  console.error('Failed to audit play logs', describeDbError(error));
  captureJobFailure('play-audit', error);
}
