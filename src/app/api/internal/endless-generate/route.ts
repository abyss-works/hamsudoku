import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createPrismaDb, type DbPort } from '../../../../server/db';
import { executeSupplyChunk } from '../../../../server/endlessGeneration';
import { OfficialQStashVerifier, type QStashVerifier } from '../../../../server/qstash';

// 10x1 청크 구성에 대한 Vercel 함수 최대 실행 시간 (초 단위)
// 주의: 로컬 CLI 측정값은 함수 실행 시간 예산의 참고 자료일 뿐이며 Vercel 환경에서의 실측 완료를 증명하지 않는다.
export const maxDuration = 60;

export const endlessGeneratePayloadSchema = z.object({
  jobId: z.string().min(1, 'jobId is required'),
  // 작업당 단일 청크 0 정책: 0이 아닌 청크 번호는 즉시 400을 반환하여 잘못된 입력에 의한 무한 재시도를 방지한다.
  chunkIndex: z.literal(0, { message: 'chunkIndex must be 0 (single chunk per job)' }),
});

export interface GenerateRouteDeps {
  verifier?: QStashVerifier;
  db?: DbPort;
}

export async function handleEndlessGenerate(req: Request, deps?: GenerateRouteDeps) {
  const verifier = deps?.verifier ?? new OfficialQStashVerifier();
  const rawBody = await req.text();

  const isVerified = await verifier.verify(req, rawBody);
  if (!isVerified) {
    return NextResponse.json({ ok: false, error: 'Unauthorized signature' }, { status: 401 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = endlessGeneratePayloadSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid payload: jobId (string) and chunkIndex (0) are required' },
      { status: 400 },
    );
  }

  const db = deps?.db ?? createPrismaDb();
  const result = await executeSupplyChunk(db, {
    jobId: parsed.data.jobId,
    chunkIndex: parsed.data.chunkIndex as number,
  });

  if (!result.ok) {
    // 다른 워커가 유효한 임대를 보유하고 실행 중인 경우 429로 응답하여 QStash의 재시도 백오프를 유도한다.
    if (result.reason === 'CLAIM_BUSY') {
      return NextResponse.json(result, { status: 429 });
    }
    // 일시적 오류나 생성 실패는 500으로 응답하여 QStash 재시도 정책(최대 3회)을 트리거한다.
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result, { status: 200 });
}

export async function POST(req: Request) {
  return handleEndlessGenerate(req);
}
