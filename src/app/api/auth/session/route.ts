import { after, NextResponse } from 'next/server';
import { rememberAccount } from '../../../../server/account/rememberAccount';
import { ensureSession } from '../../../../server/auth';

export async function POST() {
  const uid = await ensureSession();
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });
  rememberAccount({ uid, email: null }, after);
  return NextResponse.json({ ok: true, uid });
}
