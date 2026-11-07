import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdmin } from '../../../../server/admin';
import { getSessionUser } from '../../../../server/auth';
import { excludeFromSeasonRank, fetchAdminSeasonRank } from '../../../../server/seasonRanking/standings';
import { withServerTiming } from '../../../../server/serverTiming';

const deleteBodySchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(200),
});

async function handleGet() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, msg: '권한이 없어요.' }, { status: 403 });
  const { season, entries } = await fetchAdminSeasonRank(new Date());
  // 닉네임이 없는 엔트리 = 게스트. 관리 화면은 이걸 기본으로 보여준다.
  return NextResponse.json({ ok: true, season, entries });
}

async function handlePost(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, msg: '권한이 없어요.' }, { status: 403 });
  const mine = (await getSessionUser()).uid;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, msg: '잘못된 요청.' }, { status: 400 });
  }
  const parsed = deleteBodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, msg: '잘못된 요청.' }, { status: 400 });
  // 자기 자신은 제외하지 않는다.
  const removed = await excludeFromSeasonRank(
    new Date(),
    parsed.data.userIds.filter((uid) => uid !== mine),
  );
  return NextResponse.json({ ok: true, removed });
}

export const GET = withServerTiming(handleGet);
export const POST = withServerTiming(handlePost);
