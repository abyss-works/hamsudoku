import * as Sentry from '@sentry/nextjs';
import { after, NextResponse } from 'next/server';
import { nextRequestSchema, nextResponseSchema } from '../../../../shared/endless';
import { getSessionUser } from '../../../../server/auth';
import { encryptSolution } from '../../../../server/crypto';
import type { SupplyEnqueuer } from '../../../../server/endlessPool/supply';
import { startEndlessStage } from '../../../../server/endlessPlay/play';
import { publishQStashChunk } from '../../../../server/qstash';
import { withServerTiming } from '../../../../server/serverTiming';

export interface NextRouteDeps {
  enqueuer?: SupplyEnqueuer;
}

export const defaultQStashEnqueuer: SupplyEnqueuer = {
  enqueueChunk: async (jobId: string, chunkIndex: number): Promise<void> => {
    await publishQStashChunk(jobId, chunkIndex);
  },
};

export async function handleNext(req: Request, deps?: NextRouteDeps) {
  const { uid } = await getSessionUser();
  if (!uid) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  const body = nextRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false, msg: '요청이 올바르지 않아요.' }, { status: 400 });

  const started = await startEndlessStage(uid, new Date(), after, deps?.enqueuer ?? defaultQStashEnqueuer, body.data.stageId);
  if (!started.ok && started.reason === 'not_retryable') {
    return NextResponse.json({ ok: false, msg: '다시 도전할 수 없는 판이에요.' }, { status: 404 });
  }
  if (!started.ok) {
    Sentry.logger.warn('Endless pool empty', {});
    return NextResponse.json({ ok: false, msg: '새 판을 준비 중이에요.' }, { status: 503 });
  }
  const encrypted = await encryptSolution(body.data.clientPublicKey, started.stage.solution);
  return NextResponse.json(
    nextResponseSchema.parse({
      stage: { id: started.stage.id, size: started.stage.size, regions: started.stage.regions },
      solutionCipher: encrypted.solutionCipher,
      serverPublicKey: encrypted.serverPublicKey,
      iv: encrypted.iv,
      attemptKey: started.attemptKey,
    }),
  );
}

async function handlePost(req: Request) {
  return handleNext(req);
}

export const POST = withServerTiming(handlePost);
