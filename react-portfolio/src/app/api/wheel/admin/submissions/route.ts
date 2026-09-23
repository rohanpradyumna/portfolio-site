import { NextRequest, NextResponse } from 'next/server';
import { listSubmissionsForAdmin } from '@/lib/wheelDb';
import { isAuthorizedAdmin } from '@/lib/wheelAuth';
import { WheelSubmissionStatus } from '@/types';

const VALID_STATUSES: (WheelSubmissionStatus | 'all')[] = ['pending', 'approved', 'rejected', 'all'];

export async function GET(req: NextRequest) {
  if (!isAuthorizedAdmin(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const statusParam = req.nextUrl.searchParams.get('status') ?? 'pending';
  if (!VALID_STATUSES.includes(statusParam as WheelSubmissionStatus | 'all')) {
    return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 400 });
  }

  try {
    const items = await listSubmissionsForAdmin(statusParam as WheelSubmissionStatus | 'all');
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error('listSubmissionsForAdmin failed:', err);
    return NextResponse.json({ ok: false, error: 'db_unavailable' }, { status: 503 });
  }
}
