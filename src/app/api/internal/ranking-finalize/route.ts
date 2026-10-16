import { NextResponse } from 'next/server';
import { z } from 'zod';
import { seasonIdSchema } from '../../../../shared/endless';
import { verifyInternalRequest } from '../../../../server/qstash';
import { finalizeSeason, recoverUnfinalizedSeasons } from '../../../../server/seasonRanking/finalization';

const finalizeBodySchema = z
  .object({
    season: seasonIdSchema.optional(),
    recover: z.boolean().optional(),
  })
  .strict();

export async function POST(req: Request) {
  let rawBody = '';
  try {
    rawBody = await req.text();
  } catch {
    rawBody = '';
  }

  const authenticated = await verifyInternalRequest(req, rawBody);
  if (!authenticated) {
    return NextResponse.json({ ok: false, msg: '인증에 실패했어요.' }, { status: 401 });
  }

  let body: z.infer<typeof finalizeBodySchema> = {};
  if (rawBody.trim()) {
    try {
      const parsedJson = JSON.parse(rawBody);
      const result = finalizeBodySchema.safeParse(parsedJson);
      if (!result.success) {
        return NextResponse.json({ ok: false, msg: '잘못된 본문 형식이에요.' }, { status: 400 });
      }
      body = result.data;
    } catch {
      return NextResponse.json({ ok: false, msg: '잘못된 본문 형식이에요.' }, { status: 400 });
    }
  }

  const now = new Date();

  try {
    if (body.season) {
      const finalized = await finalizeSeason(body.season, now);
      let recoveredSeasons: string[] = [];
      if (body.recover) {
        const recovered = await recoverUnfinalizedSeasons(now);
        recoveredSeasons = recovered.map((r) => r.header.season);
      }
      return NextResponse.json({
        ok: true,
        season: body.season,
        results: finalized.results,
        recoveredSeasons,
      });
    }

    // 시즌 지정이 없거나 복구 요청인 경우: 미확정 종료 시즌 일괄 복구
    const recovered = await recoverUnfinalizedSeasons(now);
    return NextResponse.json({
      ok: true,
      recoveredSeasons: recovered.map((r) => r.header.season),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, msg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
