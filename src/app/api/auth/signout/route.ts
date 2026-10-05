import { NextResponse } from 'next/server';
import { signOutAccount } from '../../../../server/auth';

export async function POST() {
  await signOutAccount();
  return NextResponse.json({ ok: true });
}

