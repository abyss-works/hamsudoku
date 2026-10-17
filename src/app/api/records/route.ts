import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../server/auth';
import { fetchStageRecords } from '../../../server/stageRecord/stageClears';
import { withServerTiming } from '../../../server/serverTiming';

async function handleGet() {
  const { uid } = await getSessionUser();
  const result = await fetchStageRecords(uid);
  if (result.status === 401) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  return NextResponse.json({ ok: true, clears: result.clears });
}

export const GET = withServerTiming(handleGet);
