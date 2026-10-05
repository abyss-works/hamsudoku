import { NextResponse } from 'next/server';
import { getSessionUser, isAuthConfigured } from '../../../../server/auth';

export async function GET() {
  return NextResponse.json({ ...(await getSessionUser()), cloud: isAuthConfigured() });
}

