import { NextResponse } from 'next/server';
import { signOutAccount } from '../../../../server/auth';
import { withServerTiming } from '../../../../server/serverTiming';

async function handlePost() {
  await signOutAccount();
  return NextResponse.json({ ok: true });
}

export const POST = withServerTiming(handlePost);
