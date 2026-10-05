import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../server/auth';
import { createPrismaDb } from '../../../server/db';
import { fetchRecords } from '../../../server/records';

export async function GET() {
  const { uid } = await getSessionUser();
  const result = await fetchRecords(createPrismaDb(), uid);
  if (result.status === 401) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, clears: result.clears });
}
