import { NextResponse } from 'next/server';
import { z } from 'zod';
import { executeSupplyChunk, processNextSupplyChunk } from '../../../../server/endlessPool/generation';
import { rejectUnlessCron } from '../../../../server/internalAuth';

// 작업을 지정하지 않으면 다음 처리 대상을 고른다. 작업당 단일 청크 0 정책이므로 0이 아닌 청크 번호는 400으로 거절한다.
const endlessGeneratePayloadSchema = z
  .object({
    jobId: z.string().min(1).optional(),
    chunkIndex: z.literal(0).optional(),
  })
  .strict()
  .refine((payload) => payload.chunkIndex === undefined || payload.jobId !== undefined);

/**
 * 무한모드 판 공급 생성. CronJob이 Bearer CRON_SECRET으로 주기 호출한다.
 * 본문이 비어 있거나 `{}`이면 대기·발행 실패·임대 만료 작업 중 가장 먼저 만든 작업 하나를 점유해 처리하고,
 * `{ jobId, chunkIndex?: 0 }`이면 그 작업의 청크를 처리한다. 처리할 작업이 없으면 200 `{ ok: true, idle: true }`다.
 */
export async function POST(req: Request) {
  const rejected = rejectUnlessCron(req);
  if (rejected) return rejected;

  const rawBody = await req.text().catch(() => '');
  let parsedJson: unknown = {};
  if (rawBody.trim()) {
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
    }
  }

  const parsed = endlessGeneratePayloadSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid payload: jobId must be a non-empty string and chunkIndex must be 0' },
      { status: 400 },
    );
  }

  const result = parsed.data.jobId
    ? await executeSupplyChunk({ jobId: parsed.data.jobId, chunkIndex: 0 })
    : await processNextSupplyChunk();
  if (result === null) return NextResponse.json({ ok: true, idle: true });

  if (!result.ok) {
    // 다른 실행이 유효한 임대를 보유하고 있으면 429로 응답한다. 다음 호출에서 다시 처리 대상이 된다.
    if (result.reason === 'CLAIM_BUSY') return NextResponse.json(result, { status: 429 });
    // 생성 실패는 500으로 응답한다. 실패한 작업은 다시 점유하지 않으며 다음 재고 부족 요청이 새 작업을 예약한다.
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json(result);
}
