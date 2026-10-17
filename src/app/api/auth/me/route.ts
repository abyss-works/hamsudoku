import { NextResponse } from 'next/server';
import { getSessionUser, isAuthConfigured } from '../../../../server/auth';
import { withServerTiming } from '../../../../server/serverTiming';

async function handleGet() {
  return NextResponse.json({ ...(await getSessionUser()), cloud: isAuthConfigured() });
}

export const GET = withServerTiming(handleGet);
