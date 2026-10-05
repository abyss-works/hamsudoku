import { NextResponse } from 'next/server';
import { ensureSession } from '../../../../server/auth';

export async function POST() {
  const uid = await ensureSession();
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, uid });
}
