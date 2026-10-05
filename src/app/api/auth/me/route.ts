import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../../server/auth';

export async function GET() {
  return NextResponse.json(await getSessionUser());
}

