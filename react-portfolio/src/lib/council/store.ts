// Quota storage. One row per generation, holding hashed ids, counters,
// timestamps and token counts. Never any prompt or reply text.
//
// Two implementations share these semantics exactly: neonStore (production)
// and memoryStore (tests, so the suite never touches the real database).
//
// What a row counts against, by how it ended:
//
//   reserved / done            thread, visitor cap, site generations
//   released, money was spent  visitor cap, site generations (the thread gets
//                              its exchange back, so an honest visitor may
//                              retry, but a model that returns nothing usable
//                              cannot be looped for free)
//   released, nothing spent    the visitor's failure allowance only
//
// So within any rolling 24 hours one visitor identity can hold at most
// `visitorDaily` paid generations plus `visitorDailyFailures` unpaid failures.

export const DAY_MS = 24 * 60 * 60 * 1000;
/** A reservation older than this is a crashed request, not an in-flight one. */
export const IN_FLIGHT_MS = 45_000;
/** Rows older than this are deleted. */
export const RETENTION_MS = 48 * 60 * 60 * 1000;
/** How often one server instance bothers to run the retention delete. */
export const CLEANUP_EVERY_MS = 5 * 60 * 1000;
/** Requests per visitor per 24 hours that may fail without the provider billing us. */
export const VISITOR_DAILY_FAILURES = 4;

export interface QuotaLimits {
  threadExchanges: number;
  visitorDaily: number;
  visitorDailyFailures: number;
  siteDailyGenerations: number;
  siteDailyBudgetMicroUsd: number;
  /**
   * Worst-case cost of one request. Held against the budget while a request
   * is in flight, and the margin GET uses to decide whether a new request
   * would fit, so the two can never disagree.
   */
  holdMicroUsd: number;
  /** Dev-only: do not enforce the visitor cap. Thread cap and budget still apply. */
  skipVisitorCap: boolean;
}

export interface Who {
  ipHash: string;
  cookieHash: string;
}

export interface ThreadRef {
  threadId: string;
  /** Exchanges the thread used before any live call (1 for a starter thread). */
  threadBase: number;
}

export interface ReserveInput extends Who, ThreadRef {
  requestId: string;
  action: string;
  limits: QuotaLimits;
}

export type ReserveRefusal = 'duplicate_in_flight' | 'duplicate_done' | 'busy' | 'thread_limit' | 'visitor_limit' | 'budget_exhausted';

/** Where a visitor and a thread stand right now. */
export interface Standing {
  exchangesLeft: number;
  visitorLeft: number;
  /** When the visitor's next slot frees (not a full reset). */
  resetAt: string | null;
}

export type ReserveOutcome = ({ ok: true } & Standing) | ({ ok: false; code: ReserveRefusal } & Standing);

export interface SettleInput {
  requestId: string;
  /**
   * done: the visitor received text, or stopped the request themselves.
   * released: nothing reached the visitor. See the table at the top of this
   * file for what a released row still counts against.
   */
  outcome: 'done' | 'released';
  promptTokens: number;
  completionTokens: number;
  costMicroUsd: number;
  /** When set, the standing after this settlement is read back and returned. */
  report?: Who & ThreadRef & { limits: QuotaLimits };
}

export interface StatusInput extends Who {
  limits: QuotaLimits;
}

export interface StatusOutcome {
  /** False when the site-wide ceiling would refuse a new reservation. */
  siteOpen: boolean;
  /** When the site-wide ceiling lifts. Null while it is open. */
  siteResetAt: string | null;
  visitorLeft: number;
  resetAt: string | null;
}

export interface CouncilStore {
  /**
   * Atomically checks every cap and, only if all pass, records the
   * generation. Concurrent calls can never jointly exceed a cap.
   */
  reserve(input: ReserveInput): Promise<ReserveOutcome>;
  settle(input: SettleInput): Promise<Standing | null>;
  status(input: StatusInput): Promise<StatusOutcome>;
}

/** Site-wide daily counters reset at the next UTC midnight. */
export function nextUtcMidnight(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

export function utcDayStart(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// ---------------------------------------------------------------------------
// Shared decision logic. The SQL in neonStore mirrors `decide` line for line;
// keeping the order here in one place is what keeps the two stores honest.
// ---------------------------------------------------------------------------

/** Rows of one kind for one identifier, inside the rolling window. */
export interface Bucket {
  count: number;
  /** Creation time of the oldest such row. */
  oldest: number | null;
  /**
   * Creation time of the row whose expiry brings the count back under its
   * limit (the limit-th newest). Null while the count is under the limit.
   */
  boundary: number | null;
}

export interface Snapshot {
  /** State of an existing row with the same request id, if any. */
  existing: 'none' | 'in_flight' | 'settled';
  threadUsed: number;
  threadInFlight: number;
  /** Generations that count against the visitor cap, by IP and by cookie. */
  ip: Bucket;
  cookie: Bucket;
  /** Failures that cost nothing, by IP and by cookie. */
  ipFailed: Bucket;
  cookieFailed: Bucket;
  siteGenerations: number;
  /** Settled cost plus outstanding holds, today (UTC). */
  siteMicroUsd: number;
}

export const EMPTY_BUCKET: Bucket = { count: 0, oldest: null, boundary: null };

/** The visitor is over when EITHER identifier is, on EITHER allowance. */
function visitorBlocked(snapshot: Snapshot, limits: QuotaLimits): boolean {
  if (limits.skipVisitorCap) return false;
  return (
    snapshot.ip.count >= limits.visitorDaily ||
    snapshot.cookie.count >= limits.visitorDaily ||
    snapshot.ipFailed.count >= limits.visitorDailyFailures ||
    snapshot.cookieFailed.count >= limits.visitorDailyFailures
  );
}

/** Same rule for POST and GET: would one more worst-case request fit? */
export function siteOpen(snapshot: Pick<Snapshot, 'siteGenerations' | 'siteMicroUsd'>, limits: QuotaLimits): boolean {
  return snapshot.siteGenerations < limits.siteDailyGenerations && snapshot.siteMicroUsd + limits.holdMicroUsd <= limits.siteDailyBudgetMicroUsd;
}

export function decide(snapshot: Snapshot, input: ReserveInput): ReserveRefusal | 'ok' {
  const { limits } = input;
  if (snapshot.existing === 'in_flight') return 'duplicate_in_flight';
  if (snapshot.existing === 'settled') return 'duplicate_done';
  if (snapshot.threadInFlight > 0) return 'busy';
  if (snapshot.threadUsed + input.threadBase >= limits.threadExchanges) return 'thread_limit';
  if (visitorBlocked(snapshot, limits)) return 'visitor_limit';
  if (!siteOpen(snapshot, limits)) return 'budget_exhausted';
  return 'ok';
}

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

export function visitorStanding(snapshot: Snapshot, limits: QuotaLimits): { visitorLeft: number; resetAt: number | null } {
  if (limits.skipVisitorCap) return { visitorLeft: limits.visitorDaily, resetAt: null };
  const binding: number[] = [];
  const check = (bucket: Bucket, limit: number) => {
    if (bucket.count >= limit) binding.push((bucket.boundary ?? bucket.oldest ?? 0) + DAY_MS);
  };
  check(snapshot.ip, limits.visitorDaily);
  check(snapshot.cookie, limits.visitorDaily);
  check(snapshot.ipFailed, limits.visitorDailyFailures);
  check(snapshot.cookieFailed, limits.visitorDailyFailures);
  // Blocked: free again once the LAST binding constraint lets go.
  if (binding.length > 0) return { visitorLeft: 0, resetAt: Math.max(...binding) };
  const oldest = [snapshot.ip.oldest, snapshot.cookie.oldest].filter((v): v is number => v !== null);
  return {
    visitorLeft: Math.max(0, limits.visitorDaily - Math.max(snapshot.ip.count, snapshot.cookie.count)),
    resetAt: oldest.length > 0 ? Math.min(...oldest) + DAY_MS : null,
  };
}

export function toStanding(snapshot: Snapshot, thread: ThreadRef, limits: QuotaLimits): Standing {
  const visitor = visitorStanding(snapshot, limits);
  return {
    exchangesLeft: Math.max(0, limits.threadExchanges - thread.threadBase - snapshot.threadUsed),
    visitorLeft: visitor.visitorLeft,
    resetAt: iso(visitor.resetAt),
  };
}

function withOneMore(bucket: Bucket, limit: number, now: number): Bucket {
  const count = bucket.count + 1;
  const oldest = bucket.oldest ?? now;
  // The new row is the newest, so the limit-th newest is the old oldest.
  return { count, oldest, boundary: count >= limit ? oldest : null };
}

/** `snapshot` is the state BEFORE this request was recorded. */
export function toOutcome(verdict: ReserveRefusal | 'ok', snapshot: Snapshot, input: ReserveInput, now: number): ReserveOutcome {
  const { limits } = input;
  if (verdict === 'ok') {
    const after: Snapshot = {
      ...snapshot,
      threadUsed: snapshot.threadUsed + 1,
      ip: withOneMore(snapshot.ip, limits.visitorDaily, now),
      cookie: withOneMore(snapshot.cookie, limits.visitorDaily, now),
    };
    return { ok: true, ...toStanding(after, input, limits) };
  }
  const standing = toStanding(snapshot, input, limits);
  if (verdict === 'budget_exhausted') return { ok: false, code: verdict, ...standing, resetAt: iso(nextUtcMidnight(now)) };
  return { ok: false, code: verdict, ...standing };
}

export function toStatus(snapshot: Snapshot, limits: QuotaLimits, now: number): StatusOutcome {
  const visitor = visitorStanding(snapshot, limits);
  const open = siteOpen(snapshot, limits);
  return {
    siteOpen: open,
    siteResetAt: open ? null : iso(nextUtcMidnight(now)),
    visitorLeft: visitor.visitorLeft,
    resetAt: iso(visitor.resetAt),
  };
}
