import { NextResponse } from 'next/server';
import { createPrismaDb } from '../../../../server/db';
import { executeSupplyChunk } from '../../../../server/endlessGeneration';
import { verifyQStashSignature } from '../../../../server/qstash';

export const maxDuration = 60;

export async function POST(req: Request) {
  const rawBody = await req.text();

  const isVerified = await verifyQStashSignature(req, rawBody);
  if (!isVerified) {
    return NextResponse.json({ ok: false, error: 'Unauthorized signature' }, { status: 401 });
  }

  let body: { jobId?: string; chunkIndex?: number };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.jobId !== 'string' || typeof body.chunkIndex !== 'number') {
    return NextResponse.json(
      { ok: false, error: 'jobId (string) and chunkIndex (number) are required' },
      { status: 400 },
    );
  }

  const db = createPrismaDb();
  const result = await executeSupplyChunk(db, {
    jobId: body.jobId,
    chunkIndex: body.chunkIndex,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result, { status: 200 });
}
