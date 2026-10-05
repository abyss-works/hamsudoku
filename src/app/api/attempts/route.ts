import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '../../../server/auth';
import { createPrismaDb } from '../../../server/db';
import { issueEntry } from '../../../server/records';

const Body = z.object({ stageCode: z.string().min(1) });

export async function POST(req: Request) {
  const { uid } = await getSessionUser();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, msg: '스테이지 코드를 확인하세요.' }, { status: 400 });
  const result = await issueEntry(createPrismaDb(), uid, parsed.data.stageCode);
  if (result.status === 401) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ attemptKey: result.key });
}
