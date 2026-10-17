import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '../../../server/auth';
import { submitStageClear } from '../../../server/stageRecord/stageClears';
import { withServerTiming } from '../../../server/serverTiming';

const Body = z.object({
  attemptKey: z.string().optional(),
  elapsedSec: z.number().int().min(0),
  stageCode: z.string().optional(),
});

async function handlePost(req: Request) {
  const { uid } = await getSessionUser();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, msg: '요청을 확인하세요.' }, { status: 400 });
  const result = await submitStageClear(uid, parsed.data, new Date().toISOString());
  if (result.status === 401) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  if (result.status === 403) return NextResponse.json({ ok: false, msg: '입장 키가 유효하지 않아요.' }, { status: 403 });
  if (result.status === 400) return NextResponse.json({ ok: false, msg: '요청을 확인하세요.' }, { status: 400 });
  return NextResponse.json({ ok: true, bestElapsedSec: result.bestElapsedSec });
}

export const POST = withServerTiming(handlePost);
