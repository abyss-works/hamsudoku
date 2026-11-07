import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { rejectUnlessCron } from '../../../../server/internalAuth';
import { auditPlayLogs, reportAuditFailure } from '../../../../server/endlessPlay/playAudit';

/** 무한모드 플레이 기록의 사후 감사. 내부 인증 요청만 받고 본문은 사용하지 않으며, 처리 건수를 응답하고 플래그별 건수와 함께 기록한다. */
export async function POST(req: Request) {
  const rejected = rejectUnlessCron(req);
  if (rejected) return rejected;

  try {
    const { audited, flagged, flagCounts } = await auditPlayLogs(new Date());
    const flagAttributes = Object.fromEntries(Object.entries(flagCounts).map(([flag, count]) => [`flag_${flag}`, count]));
    Sentry.logger.info('Endless play audit', { audited, flagged, ...flagAttributes });
    return NextResponse.json({ ok: true, audited, flagged });
  } catch (error: unknown) {
    reportAuditFailure(error);
    return NextResponse.json({ ok: false, msg: '감사를 완료하지 못했어요.' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
