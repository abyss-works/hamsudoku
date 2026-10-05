import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '../../../server/auth';
import { createPrismaDb } from '../../../server/db';
import { submitClear } from '../../../server/records';

const Body = z.object({
  attemptKey: z.string().optional(),
  elapsedSec: z.number().int().min(0),
  stageCode: z.string().optional(),
});

export async function POST(req: Request) {
  const { uid, email } = await getSessionUser();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, msg: '요청을 확인하세요.' }, { status: 400 });
  const db = createPrismaDb();
  if (uid) await db.ensureUser(uid, email);
  const result = await submitClear(db, uid, parsed.data, new Date().toISOString());
  if (result.status === 401) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  if (result.status === 403) return NextResponse.json({ ok: false, msg: '입장 키가 유효하지 않아요.' }, { status: 403 });
  if (result.status === 400) return NextResponse.json({ ok: false, msg: '요청을 확인하세요.' }, { status: 400 });
  return NextResponse.json({ ok: true, bestElapsedSec: result.bestElapsedSec });
}
