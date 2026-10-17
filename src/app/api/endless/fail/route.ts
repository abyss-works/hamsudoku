import * as Sentry from '@sentry/nextjs';
import { after, NextResponse } from 'next/server';
import { failRequestSchema } from '../../../../shared/endless';
import { getSessionUser } from '../../../../server/auth';
import { submitEndlessFail } from '../../../../server/endlessPlay/play';

export async function POST(req: Request) {
  const { uid } = await getSessionUser();
  if (!uid) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  const body = failRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false, msg: '요청이 올바르지 않아요.' }, { status: 400 });
  const result = await submitEndlessFail(uid, body.data, new Date().toISOString(), after);
  if (result.status === 200) return NextResponse.json({ ok: true });
  if (result.status === 401) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  // 401(비로그인)은 제외하고 위조·만료·모드 불일치 시도만 남긴다.
  Sentry.logger.warn('Endless fail rejected', { status: result.status });
  return NextResponse.json({ ok: false, msg: '입장 키가 유효하지 않아요.' }, { status: 403 });
}
