import { NextResponse } from 'next/server';
import { exchangeRecoveryCode } from '../../../../server/auth';
import { withServerTiming } from '../../../../server/serverTiming';

// 재설정 메일 링크 착지 — code를 세션으로 교환하고 새 비밀번호 화면으로 보낸다.
async function handleGet(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(`${url.origin}/?recovery=error`);
  }
  const exchanged = await exchangeRecoveryCode(code);
  return NextResponse.redirect(`${url.origin}/${exchanged ? '?recovery=1' : '?recovery=error'}`);
}

export const GET = withServerTiming(handleGet);
