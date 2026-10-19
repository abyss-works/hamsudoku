import { NextResponse } from 'next/server';
import { isDatabaseAvailable } from '../../../server/health';
import { withServerTiming } from '../../../server/serverTiming';

// 외부 가용성 감시가 서버 함수와 DB까지 확인하도록 CDN과 브라우저 캐시를 쓰지 않는다.
const NO_STORE = { 'Cache-Control': 'no-store' };

async function handleGet() {
  return (await isDatabaseAvailable())
    ? NextResponse.json({ ok: true }, { headers: NO_STORE })
    : NextResponse.json({ ok: false }, { status: 503, headers: NO_STORE });
}

export const GET = withServerTiming(handleGet);
