import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import {
  Bucket,
  CLEANUP_EVERY_MS,
  CouncilStore,
  IN_FLIGHT_MS,
  QuotaLimits,
  ReserveInput,
  ReserveOutcome,
  ReserveRefusal,
  SettleInput,
  Snapshot,
  Standing,
  StatusInput,
  StatusOutcome,
  decide,
  toOutcome,
  toStanding,
  toStatus,
} from './store';

// This database also holds the live wheel_* tables. Every statement in this
// file is scoped to council_generations and is additive: nothing here may
// ever alter, drop or write to another table.

export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS council_generations (
    request_id         text PRIMARY KEY,
    thread_id          text NOT NULL,
    ip_hash            text NOT NULL,
    cookie_hash        text NOT NULL,
    action             text NOT NULL,
    model              text,
    status             text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'done', 'released')),
    created_at         timestamptz NOT NULL DEFAULT now(),
    finished_at        timestamptz,
    prompt_tokens      integer,
    completion_tokens  integer,
    cost_micro_usd     bigint NOT NULL DEFAULT 0,
    reserved_micro_usd bigint NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS council_generations_created_idx ON council_generations (created_at)`,
];

// Serializes reservations. Counting rows in a rolling window is only safe
// when no other reservation can slip in between the count and the insert, so
// each reservation takes this transaction-scoped advisory lock first. The
// statement after it then runs on a snapshot that includes every earlier
// reservation. Requests that an unlocked read can already refuse never get
// this far, so a flood of over-the-cap requests does not queue real ones.
const RESERVE_LOCK_KEY = '7403158297311';

const DAY_START = `(date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')`;
const IN_WINDOW = `created_at > now() - interval '24 hours'`;
const IN_FLIGHT = `status = 'reserved' AND created_at > now() - ($5::bigint * interval '1 millisecond')`;
// A released row on which money was spent still counts against the visitor
// and the site. A released row that cost nothing is a "failure".
const COUNTED = `(status <> 'released' OR cost_micro_usd > 0)`;
const FAILED = `(status = 'released' AND cost_micro_usd = 0)`;
const ms = (expr: string) => `(extract(epoch FROM ${expr}) * 1000)::bigint`;

/** count, oldest and the limit-th newest creation time of the rows matching `where`. */
function bucketColumns(name: string, where: string, limitParam: string): string {
  const filter = `FILTER (WHERE ${where} AND ${IN_WINDOW})`;
  return `
    count(*) ${filter}::int AS ${name}_count,
    ${ms(`min(created_at) ${filter}`)} AS ${name}_oldest,
    ${ms(`(array_agg(created_at ORDER BY created_at DESC) ${filter})[${limitParam}::int]`)} AS ${name}_boundary`;
}

// $1 request id (or null)  $2 thread id (or null)  $3 ip hash  $4 cookie hash
// $5 in-flight ms  $6 visitor cap  $7 visitor failure cap
const SNAPSHOT_SQL = `
  SELECT
    coalesce((
      SELECT CASE WHEN ${IN_FLIGHT} THEN 'in_flight' ELSE 'settled' END
      FROM council_generations WHERE request_id = $1::text
    ), 'none') AS existing,
    count(*) FILTER (WHERE thread_id = $2::text AND status <> 'released' AND ${IN_WINDOW})::int AS thread_used,
    count(*) FILTER (WHERE thread_id = $2::text AND ${IN_FLIGHT})::int AS thread_in_flight,
    ${bucketColumns('ip', `ip_hash = $3::text AND ${COUNTED}`, '$6')},
    ${bucketColumns('cookie', `cookie_hash = $4::text AND ${COUNTED}`, '$6')},
    ${bucketColumns('ip_failed', `ip_hash = $3::text AND ${FAILED}`, '$7')},
    ${bucketColumns('cookie_failed', `cookie_hash = $4::text AND ${FAILED}`, '$7')},
    count(*) FILTER (WHERE ${COUNTED} AND created_at >= ${DAY_START})::int AS site_generations,
    coalesce(sum(cost_micro_usd + reserved_micro_usd) FILTER (WHERE created_at >= ${DAY_START}), 0)::bigint AS site_micro_usd,
    ${ms('now()')} AS now_ms
  FROM council_generations
  WHERE request_id IS DISTINCT FROM $1::text`;

// $8 action  $9 model  $10 thread base  $11 thread cap  $12 skip visitor cap
// $13 site generations cap  $14 site budget micro usd  $15 hold micro usd
//
// The CASE mirrors decide() in store.ts, in the same order.
const RESERVE_SQL = `
WITH snap AS (${SNAPSHOT_SQL}
), verdict AS (
  SELECT CASE
    WHEN existing = 'in_flight' THEN 'duplicate_in_flight'
    WHEN existing = 'settled' THEN 'duplicate_done'
    WHEN thread_in_flight > 0 THEN 'busy'
    WHEN thread_used + $10::int >= $11::int THEN 'thread_limit'
    WHEN NOT $12::boolean AND (
      ip_count >= $6::int OR cookie_count >= $6::int OR ip_failed_count >= $7::int OR cookie_failed_count >= $7::int
    ) THEN 'visitor_limit'
    WHEN site_generations >= $13::int OR site_micro_usd + $15::bigint > $14::bigint THEN 'budget_exhausted'
    ELSE 'ok'
  END AS verdict
  FROM snap
), ins AS (
  INSERT INTO council_generations (request_id, thread_id, ip_hash, cookie_hash, action, model, status, reserved_micro_usd)
  SELECT $1::text, $2::text, $3::text, $4::text, $8::text, $9::text, 'reserved', $15::bigint FROM verdict WHERE verdict = 'ok'
  ON CONFLICT (request_id) DO NOTHING
  RETURNING 1
)
SELECT snap.*, verdict.verdict, (SELECT count(*) FROM ins)::int AS inserted
FROM snap, verdict`;

const SETTLE_SQL = `
UPDATE council_generations SET
  status = $2,
  finished_at = now(),
  prompt_tokens = $3::int,
  completion_tokens = $4::int,
  cost_micro_usd = cost_micro_usd + $5::bigint,
  reserved_micro_usd = 0
WHERE request_id = $1 AND status = 'reserved'`;

const CLEANUP_SQL = `DELETE FROM council_generations WHERE created_at < now() - interval '48 hours'`;

type Num = string | number | null;

interface SnapshotRow {
  existing: Snapshot['existing'];
  thread_used: number;
  thread_in_flight: number;
  ip_count: number;
  ip_oldest: Num;
  ip_boundary: Num;
  cookie_count: number;
  cookie_oldest: Num;
  cookie_boundary: Num;
  ip_failed_count: number;
  ip_failed_oldest: Num;
  ip_failed_boundary: Num;
  cookie_failed_count: number;
  cookie_failed_oldest: Num;
  cookie_failed_boundary: Num;
  site_generations: number;
  site_micro_usd: Num;
  now_ms: Num;
  verdict?: ReserveRefusal | 'ok';
  inserted?: number;
}

const num = (value: Num) => (value === null ? null : Number(value));
const bucket = (count: number, oldest: Num, boundary: Num): Bucket => ({ count, oldest: num(oldest), boundary: num(boundary) });

function toSnapshot(row: SnapshotRow): Snapshot {
  return {
    existing: row.existing,
    threadUsed: row.thread_used,
    threadInFlight: row.thread_in_flight,
    ip: bucket(row.ip_count, row.ip_oldest, row.ip_boundary),
    cookie: bucket(row.cookie_count, row.cookie_oldest, row.cookie_boundary),
    ipFailed: bucket(row.ip_failed_count, row.ip_failed_oldest, row.ip_failed_boundary),
    cookieFailed: bucket(row.cookie_failed_count, row.cookie_failed_oldest, row.cookie_failed_boundary),
    siteGenerations: row.site_generations,
    siteMicroUsd: Number(row.site_micro_usd),
  };
}

function snapshotParams(requestId: string | null, threadId: string | null, who: { ipHash: string; cookieHash: string }, limits: QuotaLimits) {
  return [requestId, threadId, who.ipHash, who.cookieHash, IN_FLIGHT_MS, limits.visitorDaily, limits.visitorDailyFailures];
}

export class NeonCouncilStore implements CouncilStore {
  private sql: NeonQueryFunction<false, false>;
  private schemaReady: Promise<void> | null = null;
  private lastCleanupAt = 0;

  constructor(
    databaseUrl: string,
    private readonly model: string,
  ) {
    this.sql = neon(databaseUrl);
  }

  // Once per server instance. IF NOT EXISTS makes it safe to race.
  private ensureSchema(): Promise<void> {
    this.schemaReady ??= this.sql
      .transaction(SCHEMA_STATEMENTS.map((statement) => this.sql.query(statement)))
      .then(() => undefined)
      .catch((err) => {
        this.schemaReady = null;
        throw err;
      });
    return this.schemaReady;
  }

  /**
   * Retention: rows older than 48 hours are deleted. Runs alongside reads
   * (GET status and the reservation pre-check), at most once every few
   * minutes per server instance, and never inside the reservation lock.
   */
  private async cleanupIfDue(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCleanupAt < CLEANUP_EVERY_MS) return;
    this.lastCleanupAt = now;
    try {
      await this.sql.query(CLEANUP_SQL);
    } catch {
      // Not worth failing a request over. It runs again next time it is due.
      this.lastCleanupAt = 0;
    }
  }

  private async snapshot(requestId: string | null, threadId: string | null, who: { ipHash: string; cookieHash: string }, limits: QuotaLimits) {
    const rows = (await this.sql.query(SNAPSHOT_SQL, snapshotParams(requestId, threadId, who, limits))) as SnapshotRow[];
    return { snapshot: toSnapshot(rows[0]), now: Number(rows[0].now_ms) };
  }

  async reserve(input: ReserveInput): Promise<ReserveOutcome> {
    await this.ensureSchema();
    const { limits } = input;

    // Cheap, read-only and unlocked. Anything it can already refuse (a
    // visitor over the cap, a spent thread, an exhausted site) stops here.
    const [pre] = await Promise.all([this.snapshot(input.requestId, input.threadId, input, limits), this.cleanupIfDue()]);
    const early = decide(pre.snapshot, input);
    if (early !== 'ok') return toOutcome(early, pre.snapshot, input, pre.now);

    // Authoritative: the same check again, under the lock, with the insert.
    const results = await this.sql.transaction([
      this.sql.query('SELECT pg_advisory_xact_lock($1::bigint)', [RESERVE_LOCK_KEY]),
      this.sql.query(RESERVE_SQL, [
        ...snapshotParams(input.requestId, input.threadId, input, limits),
        input.action,
        this.model,
        input.threadBase,
        limits.threadExchanges,
        limits.skipVisitorCap,
        limits.siteDailyGenerations,
        limits.siteDailyBudgetMicroUsd,
        limits.holdMicroUsd,
      ]),
    ]);
    const row = (results[1] as SnapshotRow[])[0];
    let verdict = row.verdict ?? 'budget_exhausted';
    if (verdict === 'ok' && row.inserted !== 1) verdict = 'duplicate_done';
    return toOutcome(verdict, toSnapshot(row), input, Number(row.now_ms));
  }

  async settle(input: SettleInput): Promise<Standing | null> {
    const update = this.sql.query(SETTLE_SQL, [input.requestId, input.outcome, input.promptTokens, input.completionTokens, input.costMicroUsd]);
    if (!input.report) {
      await update;
      return null;
    }
    const { report } = input;
    // Same round trip: settle, then read where the visitor and thread stand.
    const results = await this.sql.transaction([update, this.sql.query(SNAPSHOT_SQL, snapshotParams(null, report.threadId, report, report.limits))]);
    return toStanding(toSnapshot((results[1] as SnapshotRow[])[0]), report, report.limits);
  }

  async status(input: StatusInput): Promise<StatusOutcome> {
    await this.ensureSchema();
    const [current] = await Promise.all([this.snapshot(null, null, input, input.limits), this.cleanupIfDue()]);
    return toStatus(current.snapshot, input.limits, current.now);
  }
}
