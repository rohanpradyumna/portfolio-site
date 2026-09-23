import { NextRequest, NextResponse } from 'next/server';
import { updateSubmissionStatus } from '@/lib/wheelDb';
import { isAuthorizedAdmin } from '@/lib/wheelAuth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorizedAdmin(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }

  let payload: { status?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  // 'pending' is the default/reset state, not an action an admin takes.
  if (payload.status !== 'approved' && payload.status !== 'rejected') {
    return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 400 });
  }

  try {
    const updated = await updateSubmissionStatus(id, payload.status);
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id: updated.id, status: updated.status });
  } catch (err) {
    console.error('updateSubmissionStatus failed:', err);
    return NextResponse.json({ ok: false, error: 'db_unavailable' }, { status: 503 });
  }
}
