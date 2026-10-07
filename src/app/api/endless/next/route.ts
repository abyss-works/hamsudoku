import { NextResponse } from 'next/server';
import { nextRequestSchema, nextResponseSchema } from '../../../../shared/endless';
import { getSessionUser } from '../../../../server/auth';
import { encryptSolution } from '../../../../server/crypto';
import { createPrismaDb } from '../../../../server/db';

export async function POST(req: Request) {
  const { uid } = await getSessionUser();
  if (!uid) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  const body = nextRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false, msg: '요청이 올바르지 않아요.' }, { status: 400 });
  const db = createPrismaDb();
  const stage = await db.pickUnclearedStage(uid);
  if (!stage) return NextResponse.json({ ok: false, msg: '새 판을 준비 중이에요.' }, { status: 503 });
  const attempt = await db.issueAttempt(uid, stage.id);
  const encrypted = await encryptSolution(body.data.clientPublicKey, stage.solution);
  return NextResponse.json(
    nextResponseSchema.parse({
      stage: { id: stage.id, size: stage.size, regions: stage.regions },
      solutionCipher: encrypted.solutionCipher,
      serverPublicKey: encrypted.serverPublicKey,
      iv: encrypted.iv,
      attemptKey: attempt.id,
    }),
  );
}
