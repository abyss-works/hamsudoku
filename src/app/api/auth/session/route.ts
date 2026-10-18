import { after, NextResponse } from 'next/server';
import { rememberAccount } from '../../../../server/account/rememberAccount';
import { ensureSession } from '../../../../server/auth';
import { withServerTiming } from '../../../../server/serverTiming';

async function handlePost() {
  const session = await ensureSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  rememberAccount({ uid: session.uid, email: session.email }, after);
  return NextResponse.json({ ok: true, uid: session.uid, email: session.email });
}

export const POST = withServerTiming(handlePost);
