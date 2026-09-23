import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { WheelSubmission, WheelSubmissionStatus } from '@/types';

// Lazy: Next evaluates route modules during build-time page-data collection,
// so creating the client eagerly at module scope would require DATABASE_URL
// to exist at build time. Deferring to first call means it's only needed
// when a request actually reaches one of these functions.
let cachedSql: NeonQueryFunction<false, false> | null = null;
function getSql() {
  if (!cachedSql) cachedSql = neon(process.env.DATABASE_URL!);
  return cachedSql;
}

// Row shape as it comes back from Postgres (snake_case columns).
interface SubmissionRow {
  id: number;
  topic_id: string;
  category: string;
  topic_text: string;
  author_name: string | null;
  is_anonymous: boolean;
  body: string;
  status: WheelSubmissionStatus;
  created_at: string;
  reviewed_at: string | null;
}

function mapRow(row: SubmissionRow): WheelSubmission {
  return {
    id: row.id,
    topicId: row.topic_id,
    category: row.category,
    topicText: row.topic_text,
    authorName: row.author_name,
    isAnonymous: row.is_anonymous,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

export async function createSubmission(input: {
  topicId: string;
  category: string;
  topicText: string;
  authorName: string | null;
  isAnonymous: boolean;
  body: string;
}): Promise<number> {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO wheel_submissions (topic_id, category, topic_text, author_name, is_anonymous, body)
    VALUES (${input.topicId}, ${input.category}, ${input.topicText}, ${input.authorName}, ${input.isAnonymous}, ${input.body})
    RETURNING id
  `) as { id: number }[];
  return rows[0].id;
}

export async function listApprovedSubmissions(opts: {
  topicId?: string;
  limit?: number;
  cursor?: number;
}): Promise<{ items: WheelSubmission[]; nextCursor: number | null }> {
  const sql = getSql();
  const limit = Math.min(opts.limit ?? 20, 50);
  // Fetch one extra row to know whether another page exists.
  const rows = (opts.topicId
    ? opts.cursor
      ? await sql`
          SELECT * FROM wheel_submissions
          WHERE status = 'approved' AND topic_id = ${opts.topicId} AND id < ${opts.cursor}
          ORDER BY created_at DESC, id DESC LIMIT ${limit + 1}
        `
      : await sql`
          SELECT * FROM wheel_submissions
          WHERE status = 'approved' AND topic_id = ${opts.topicId}
          ORDER BY created_at DESC, id DESC LIMIT ${limit + 1}
        `
    : opts.cursor
      ? await sql`
          SELECT * FROM wheel_submissions
          WHERE status = 'approved' AND id < ${opts.cursor}
          ORDER BY created_at DESC, id DESC LIMIT ${limit + 1}
        `
      : await sql`
          SELECT * FROM wheel_submissions
          WHERE status = 'approved'
          ORDER BY created_at DESC, id DESC LIMIT ${limit + 1}
        `) as SubmissionRow[];

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: page.map(mapRow),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

export async function listSubmissionsForAdmin(status: WheelSubmissionStatus | 'all'): Promise<WheelSubmission[]> {
  const sql = getSql();
  const rows = (status === 'all'
    ? await sql`SELECT * FROM wheel_submissions ORDER BY created_at DESC LIMIT 200`
    : await sql`SELECT * FROM wheel_submissions WHERE status = ${status} ORDER BY created_at DESC LIMIT 200`) as SubmissionRow[];
  return rows.map(mapRow);
}

export async function updateSubmissionStatus(
  id: number,
  status: 'approved' | 'rejected'
): Promise<WheelSubmission | null> {
  const sql = getSql();
  const rows = (await sql`
    UPDATE wheel_submissions
    SET status = ${status}, reviewed_at = now()
    WHERE id = ${id}
    RETURNING *
  `) as SubmissionRow[];
  return rows[0] ? mapRow(rows[0]) : null;
}
