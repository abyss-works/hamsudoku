import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * 내부 작업 요청의 인증. `Authorization: Bearer <CRON_SECRET>`만 허용한다.
 * CRON_SECRET이 설정되지 않았거나 비어 있으면 모든 요청을 거절한다.
 */
export function verifyCronRequest(req: Request, env: Record<string, string | undefined> = process.env): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return false;
  return safeEqual(header.slice('Bearer '.length), secret);
}

/** 인증되지 않은 내부 작업 요청이면 401 응답을, 인증되었으면 null을 돌려준다. */
export function rejectUnlessCron(req: Request): NextResponse | null {
  if (verifyCronRequest(req)) return null;
  return NextResponse.json({ ok: false, msg: '인증에 실패했어요.' }, { status: 401 });
}
