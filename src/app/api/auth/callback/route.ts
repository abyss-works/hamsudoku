import { NextResponse } from 'next/server';
import { exchangeRecoveryCode } from '../../../../server/auth';
import { withServerTiming } from '../../../../server/serverTiming';

// 재설정 메일 링크 착지 — 토큰을 세션으로 교환하고 새 비밀번호 화면으로 보낸다.
// 이동 주소는 프록시 뒤의 요청 주소가 아니라 공개 주소(BETTER_AUTH_URL)를 따른다.
async function handleGet(req: Request) {
  const url = new URL(req.url);
  const origin = process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL).origin : url.origin;
  const token = url.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(`${origin}/?recovery=error`);
  }
  const exchanged = await exchangeRecoveryCode(token);
  return NextResponse.redirect(`${origin}/${exchanged ? '?recovery=1' : '?recovery=error'}`);
}

export const GET = withServerTiming(handleGet);
