import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { verifyInternalRequest } from '../../../../server/qstash';
import { auditPlayLogs, reportAuditFailure } from '../../../../server/endlessPlay/playAudit';

/** 무한모드 플레이 기록의 사후 감사. 내부 인증 요청만 받고 본문은 사용하지 않으며, 처리 건수만 응답하고 기록한다. */
export async function POST(req: Request) {
  let rawBody = '';
  try {
    rawBody = await req.text();
  } catch {
    rawBody = '';
  }

  const authenticated = await verifyInternalRequest(req, rawBody);
  if (!authenticated) {
    return NextResponse.json({ ok: false, msg: '인증에 실패했어요.' }, { status: 401 });
  }

  try {
    const { audited, flagged } = await auditPlayLogs(new Date());
    Sentry.logger.info('Endless play audit', { audited, flagged });
    return NextResponse.json({ ok: true, audited, flagged });
  } catch (error: unknown) {
    reportAuditFailure(error);
    return NextResponse.json({ ok: false, msg: '감사를 완료하지 못했어요.' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
