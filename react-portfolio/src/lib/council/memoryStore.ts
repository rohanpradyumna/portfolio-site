import {
  Bucket,
  CouncilStore,
  DAY_MS,
  IN_FLIGHT_MS,
  QuotaLimits,
  RETENTION_MS,
  ReserveInput,
  ReserveOutcome,
  SettleInput,
  Snapshot,
  Standing,
  StatusInput,
  StatusOutcome,
  decide,
  toOutcome,
  toStanding,
  toStatus,
  utcDayStart,
} from './store';

export interface MemoryRow {
  requestId: string;
  threadId: string;
  ipHash: string;
  cookieHash: string;
  action: string;
  status: 'reserved' | 'done' | 'released';
  createdAt: number;
  finishedAt: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  costMicroUsd: number;
  reservedMicroUsd: number;
}

function bucket(times: number[], limit: number): Bucket {
  if (times.length === 0) return { count: 0, oldest: null, boundary: null };
  const newestFirst = [...times].sort((a, b) => b - a);
  return {
    count: times.length,
    oldest: newestFirst[newestFirst.length - 1],
    boundary: times.length >= limit && limit > 0 ? newestFirst[limit - 1] : null,
  };
}

/**
 * In-process store with the same semantics as the Neon one. `reserve` does
 * its check and its write in one synchronous step, which is this store's
 * equivalent of the database transaction.
 */
export class MemoryCouncilStore implements CouncilStore {
  readonly rows = new Map<string, MemoryRow>();

  constructor(private readonly now: () => number = Date.now) {}

  private cleanup(now: number): void {
    for (const [id, row] of this.rows) if (row.createdAt < now - RETENTION_MS) this.rows.delete(id);
  }

  private snapshot(input: { requestId?: string; threadId?: string; ipHash: string; cookieHash: string }, limits: QuotaLimits, now: number): Snapshot {
    const dayStart = utcDayStart(now);
    const times = { ip: [] as number[], cookie: [] as number[], ipFailed: [] as number[], cookieFailed: [] as number[] };
    const snap = { existing: 'none' as Snapshot['existing'], threadUsed: 0, threadInFlight: 0, siteGenerations: 0, siteMicroUsd: 0 };

    for (const row of this.rows.values()) {
      const inFlight = row.status === 'reserved' && row.createdAt > now - IN_FLIGHT_MS;
      if (row.requestId === input.requestId) {
        snap.existing = inFlight ? 'in_flight' : 'settled';
        continue;
      }
      const inWindow = row.createdAt > now - DAY_MS;
      // Released with money spent still counts against the visitor and the site.
      const counted = row.status !== 'released' || row.costMicroUsd > 0;
      if (row.threadId === input.threadId && inWindow) {
        if (row.status !== 'released') snap.threadUsed += 1;
        if (inFlight) snap.threadInFlight += 1;
      }
      if (inWindow) {
        if (row.ipHash === input.ipHash) (counted ? times.ip : times.ipFailed).push(row.createdAt);
        if (row.cookieHash === input.cookieHash) (counted ? times.cookie : times.cookieFailed).push(row.createdAt);
      }
      if (row.createdAt >= dayStart) {
        if (counted) snap.siteGenerations += 1;
        snap.siteMicroUsd += row.costMicroUsd + row.reservedMicroUsd;
      }
    }
    return {
      ...snap,
      ip: bucket(times.ip, limits.visitorDaily),
      cookie: bucket(times.cookie, limits.visitorDaily),
      ipFailed: bucket(times.ipFailed, limits.visitorDailyFailures),
      cookieFailed: bucket(times.cookieFailed, limits.visitorDailyFailures),
    };
  }

  async reserve(input: ReserveInput): Promise<ReserveOutcome> {
    const now = this.now();
    this.cleanup(now);
    const snap = this.snapshot(input, input.limits, now);
    const verdict = decide(snap, input);
    if (verdict === 'ok') {
      this.rows.set(input.requestId, {
        requestId: input.requestId,
        threadId: input.threadId,
        ipHash: input.ipHash,
        cookieHash: input.cookieHash,
        action: input.action,
        status: 'reserved',
        createdAt: now,
        finishedAt: null,
        promptTokens: null,
        completionTokens: null,
        costMicroUsd: 0,
        reservedMicroUsd: input.limits.holdMicroUsd,
      });
    }
    return toOutcome(verdict, snap, input, now);
  }

  async settle(input: SettleInput): Promise<Standing | null> {
    const row = this.rows.get(input.requestId);
    if (row && row.status === 'reserved') {
      row.status = input.outcome;
      row.finishedAt = this.now();
      row.promptTokens = input.promptTokens;
      row.completionTokens = input.completionTokens;
      row.costMicroUsd += input.costMicroUsd;
      row.reservedMicroUsd = 0;
    }
    if (!input.report) return null;
    return toStanding(this.snapshot(input.report, input.report.limits, this.now()), input.report, input.report.limits);
  }

  async status(input: StatusInput): Promise<StatusOutcome> {
    const now = this.now();
    this.cleanup(now);
    return toStatus(this.snapshot(input, input.limits, now), input.limits, now);
  }
}
