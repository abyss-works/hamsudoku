import { NextResponse } from 'next/server';
import { nextRequestSchema, nextResponseSchema } from '../../../../shared/endless';
import { getSessionUser } from '../../../../server/auth';
import { encryptSolution } from '../../../../server/crypto';
import { createPrismaDb, type DbPort } from '../../../../server/db';
import { requestSupply } from '../../../../server/endlessSupply';
import { publishQStashChunk } from '../../../../server/qstash';

export interface NextRouteDeps {
  db?: DbPort;
  enqueuer?: { enqueueChunk: (jobId: string, chunkIndex: number) => Promise<void> };
}

export const defaultQStashEnqueuer = {
  enqueueChunk: async (jobId: string, chunkIndex: number): Promise<void> => {
    await publishQStashChunk(jobId, chunkIndex);
  },
};

export async function handleNext(req: Request, deps?: NextRouteDeps) {
  const { uid } = await getSessionUser();
  if (!uid) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  const body = nextRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false, msg: '요청이 올바르지 않아요.' }, { status: 400 });

  const db = deps?.db ?? createPrismaDb();
  const enqueuer = deps?.enqueuer ?? defaultQStashEnqueuer;

  try {
    const decision = await requestSupply(db, new Date().toISOString(), enqueuer);
    if (decision.enqueueError) {
      console.warn('Supply enqueue warning (non-fatal):', decision.enqueueError);
    }
  } catch (err) {
    console.error('Failed to trigger supply:', err);
  }

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

export async function POST(req: Request) {
  return handleNext(req);
}

