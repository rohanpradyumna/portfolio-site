import { NextRequest, NextResponse } from 'next/server';
import { createSubmission, listApprovedSubmissions } from '@/lib/wheelDb';
import { findTopicById } from '@/data/wheelTopics';

const BODY_MIN = 40;
const BODY_MAX = 4000;
const NAME_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

// Best-effort only: Vercel serverless functions aren't guaranteed to share
// memory across invocations/regions, so this stops casual spam/double-submits
// but is not a hard guarantee.
const rateLimitLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (rateLimitLog.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  rateLimitLog.set(ip, hits);
  return hits.length > RATE_LIMIT_MAX;
}

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req: NextRequest) {
  let payload: {
    topicId?: string;
    authorName?: string | null;
    isAnonymous?: boolean;
    body?: string;
    website?: string;
  };

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  // Honeypot: bots fill every field, real visitors never see this one. Respond
  // as if it succeeded so bots don't learn the field failed.
  if (payload.website) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }

  const topic = payload.topicId ? findTopicById(payload.topicId) : null;
  if (!topic) {
    return NextResponse.json({ ok: false, error: 'invalid_topic' }, { status: 400 });
  }

  const body = (payload.body ?? '').trim();
  if (body.length < BODY_MIN || body.length > BODY_MAX) {
    return NextResponse.json({ ok: false, error: 'invalid_body_length' }, { status: 400 });
  }

  const isAnonymous = Boolean(payload.isAnonymous);
  const authorName = isAnonymous ? null : (payload.authorName ?? '').trim().slice(0, NAME_MAX) || null;

  try {
    const id = await createSubmission({
      topicId: topic.id,
      category: topic.categoryLabel,
      topicText: topic.text,
      authorName,
      isAnonymous,
      body,
    });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (err) {
    console.error('createSubmission failed:', err);
    return NextResponse.json({ ok: false, error: 'db_unavailable' }, { status: 503 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const topicId = searchParams.get('topicId') ?? undefined;
  const cursorParam = searchParams.get('cursor');
  const limitParam = searchParams.get('limit');

  const cursor = cursorParam ? Number(cursorParam) : undefined;
  const limit = limitParam ? Number(limitParam) : undefined;

  try {
    const { items, nextCursor } = await listApprovedSubmissions({ topicId, cursor, limit });

    // Never expose the status column to the public feed.
    const publicItems = items.map(({ id, topicId, category, topicText, authorName, isAnonymous, body, createdAt }) => ({
      id,
      topicId,
      category,
      topicText,
      authorName,
      isAnonymous,
      body,
      createdAt,
    }));

    return NextResponse.json({ ok: true, items: publicItems, nextCursor });
  } catch (err) {
    console.error('listApprovedSubmissions failed:', err);
    return NextResponse.json({ ok: false, error: 'db_unavailable' }, { status: 503 });
  }
}
