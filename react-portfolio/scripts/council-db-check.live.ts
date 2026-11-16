import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { afterAll, expect, test } from 'vitest';
import { NeonCouncilStore } from '@/lib/council/neonStore';
import { QuotaLimits, ReserveInput, ReserveOutcome } from '@/lib/council/store';

// Proves the reservation SQL against the real database: that concurrent
// requests cannot overshoot a cap. No model calls. It writes only rows whose
// ip_hash starts with this run's unique prefix, and deletes exactly those
// rows afterwards. Opt in with:
//
//   COUNCIL_DB_CHECK=1 npx vitest run --config scripts/council-live.vitest.config.mts council-db-check

const enabled = process.env.COUNCIL_DB_CHECK === '1';

function databaseUrl(): string {
  const line = readFileSync('.env.local', 'utf8')
    .split('\n')
    .find((l) => l.startsWith('DATABASE_URL='));
  const url = line?.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '') || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return url;
}

const run = `dbcheck-${randomBytes(6).toString('hex')}`;
let n = 0;

const LIMITS: QuotaLimits = {
  threadExchanges: 2,
  visitorDaily: 4,
  visitorDailyFailures: 4,
  siteDailyGenerations: 1_000_000,
  siteDailyBudgetMicroUsd: 1_000_000_000_000,
  holdMicroUsd: 1,
  skipVisitorCap: false,
};

function input(over: Partial<ReserveInput> = {}): ReserveInput {
  n += 1;
  return {
    requestId: `${run}-req-${n}`,
    threadId: `${run}-thread-${n}`,
    threadBase: 0,
    ipHash: `${run}-ip`,
    cookieHash: `${run}-cookie`,
    action: 'open',
    limits: LIMITS,
    ...over,
  };
}

const ok = (outcomes: ReserveOutcome[]) => outcomes.filter((o) => o.ok).length;
const codes = (outcomes: ReserveOutcome[]) => [...new Set(outcomes.map((o) => (o.ok ? 'ok' : o.code)))].sort();

afterAll(async () => {
  if (!enabled) return;
  const sql = neon(databaseUrl());
  const deleted = (await sql.query(`DELETE FROM council_generations WHERE ip_hash LIKE $1 RETURNING request_id`, [`${run}-%`])) as unknown[];
  console.log(`[council-db-check] removed ${deleted.length} test rows for ${run}`);
});

test.skipIf(!enabled)('reservations are atomic on the real database', async () => {
  const store = new NeonCouncilStore(databaseUrl(), 'db-check');

  // Visitor cap: 20 at once, one visitor, 20 different threads.
  const burst = await Promise.all(Array.from({ length: 20 }, () => store.reserve(input())));
  expect(ok(burst)).toBe(4);
  expect(codes(burst)).toEqual(['ok', 'visitor_limit']);
  const refused = burst.find((o) => !o.ok)!;
  expect(refused.resetAt).toMatch(/^\d{4}-\d\d-\d\dT/);
  expect(await store.status({ ipHash: `${run}-ip`, cookieHash: `${run}-cookie`, limits: LIMITS })).toMatchObject({ visitorLeft: 0 });

  // Either identifier: same cookie from a new network is still over.
  expect(await store.reserve(input({ ipHash: `${run}-ip-other` }))).toMatchObject({ ok: false, code: 'visitor_limit' });
  // And a different visitor is not.
  const stranger = { ipHash: `${run}-ip-b`, cookieHash: `${run}-cookie-b` };
  expect(await store.status({ ...stranger, limits: LIMITS })).toMatchObject({ visitorLeft: 4, resetAt: null });

  // One thread: 10 at once from 10 different visitors, one gets through.
  const sameThread = await Promise.all(
    Array.from({ length: 10 }, (_, i) => store.reserve(input({ threadId: `${run}-shared`, ipHash: `${run}-ip-t${i}`, cookieHash: `${run}-cookie-t${i}` }))),
  );
  expect(ok(sameThread)).toBe(1);
  expect(codes(sameThread)).toEqual(['busy', 'ok']);

  // Request id dedupe: the same id 8 times at once is charged once.
  const sameId = await Promise.all(
    Array.from({ length: 8 }, () => store.reserve(input({ requestId: `${run}-req-dup`, threadId: `${run}-dup`, ipHash: `${run}-ip-d`, cookieHash: `${run}-cookie-d` }))),
  );
  expect(ok(sameId)).toBe(1);
  expect(codes(sameId)).toEqual(['duplicate_in_flight', 'ok']);

  // Thread cap with settle. A failure that cost nothing gives everything
  // back, and its request id cannot be replayed.
  const who = { ipHash: `${run}-ip-e`, cookieHash: `${run}-cookie-e`, threadId: `${run}-thread-e` };
  const report = { ...who, threadBase: 0, limits: LIMITS };
  const first = input(who);
  expect(await store.reserve(first)).toMatchObject({ ok: true, exchangesLeft: 1, visitorLeft: 3 });
  expect(await store.settle({ requestId: first.requestId, outcome: 'released', promptTokens: 0, completionTokens: 0, costMicroUsd: 0, report })).toMatchObject({
    exchangesLeft: 2,
    visitorLeft: 4,
  });
  expect(await store.reserve({ ...first })).toMatchObject({ ok: false, code: 'duplicate_done' });

  // A failure the provider was paid for gives the thread back but still
  // counts against the visitor.
  const paid = input(who);
  expect(await store.reserve(paid)).toMatchObject({ ok: true, exchangesLeft: 1, visitorLeft: 3 });
  expect(await store.settle({ requestId: paid.requestId, outcome: 'released', promptTokens: 10, completionTokens: 0, costMicroUsd: 2, report })).toMatchObject({
    exchangesLeft: 2,
    visitorLeft: 3,
  });

  const second = input(who);
  expect(await store.reserve(second)).toMatchObject({ ok: true, exchangesLeft: 1, visitorLeft: 2 });
  expect(await store.settle({ requestId: second.requestId, outcome: 'done', promptTokens: 10, completionTokens: 5, costMicroUsd: 3, report })).toMatchObject({
    exchangesLeft: 1,
    visitorLeft: 2,
  });
  const third = input(who);
  expect(await store.reserve(third)).toMatchObject({ ok: true, exchangesLeft: 0, visitorLeft: 1 });
  await store.settle({ requestId: third.requestId, outcome: 'done', promptTokens: 10, completionTokens: 5, costMicroUsd: 3 });
  expect(await store.reserve(input(who))).toMatchObject({ ok: false, code: 'thread_limit', exchangesLeft: 0, visitorLeft: 1 });

  // Paid failures alone exhaust the visitor: 20 at once, 4 admitted, and
  // after they all fail (paid) nothing more is admitted.
  const loop = { ipHash: `${run}-ip-loop`, cookieHash: `${run}-cookie-loop` };
  const looped = Array.from({ length: 20 }, () => input(loop));
  const admitted = await Promise.all(looped.map((request) => store.reserve(request)));
  expect(ok(admitted)).toBe(4);
  await Promise.all(looped.map((request) => store.settle({ requestId: request.requestId, outcome: 'released', promptTokens: 3500, completionTokens: 2, costMicroUsd: 440 })));
  expect(await store.reserve(input(loop))).toMatchObject({ ok: false, code: 'visitor_limit', visitorLeft: 0 });
  expect(await store.reserve(input({ ...loop, cookieHash: `${run}-cookie-fresh` }))).toMatchObject({ ok: false, code: 'visitor_limit' });

  // Free failures have their own small allowance.
  const flaky = { ipHash: `${run}-ip-flaky`, cookieHash: `${run}-cookie-flaky` };
  for (let i = 0; i < 4; i++) {
    const request = input(flaky);
    expect((await store.reserve(request)).ok).toBe(true);
    await store.settle({ requestId: request.requestId, outcome: 'released', promptTokens: 0, completionTokens: 0, costMicroUsd: 0 });
  }
  const blocked = await store.reserve(input(flaky));
  expect(blocked).toMatchObject({ ok: false, code: 'visitor_limit', visitorLeft: 0 });
  expect(blocked.resetAt).toMatch(/^\d{4}-\d\d-\d\dT/);
  expect(await store.status({ ...flaky, limits: LIMITS })).toMatchObject({ siteOpen: true, visitorLeft: 0 });

  // Site ceiling: set it just above today's count and burst from many visitors.
  const sql = neon(databaseUrl());
  const [{ today }] = (await sql.query(
    `SELECT count(*)::int AS today FROM council_generations
     WHERE (status <> 'released' OR cost_micro_usd > 0) AND created_at >= (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')`,
  )) as { today: number }[];
  const capped = { ...LIMITS, siteDailyGenerations: today + 3 };
  const siteBurst = await Promise.all(
    Array.from({ length: 15 }, (_, i) => store.reserve(input({ ipHash: `${run}-ip-s${i}`, cookieHash: `${run}-cookie-s${i}`, limits: capped }))),
  );
  expect(ok(siteBurst)).toBe(3);
  expect(codes(siteBurst)).toEqual(['budget_exhausted', 'ok']);
  // GET agrees with POST: closed for a newcomer, whose own allowance is intact.
  const newcomer = await store.status({ ipHash: `${run}-ip-new`, cookieHash: `${run}-cookie-new`, limits: capped });
  expect(newcomer).toMatchObject({ siteOpen: false, visitorLeft: 4 });
  expect(newcomer.siteResetAt).toMatch(/T00:00:00\.000Z$/);
  expect(await store.status({ ipHash: `${run}-ip-new`, cookieHash: `${run}-cookie-new`, limits: LIMITS })).toMatchObject({ siteOpen: true, siteResetAt: null });

  // What is stored: counters and ids, and no column can hold text.
  const [row] = (await sql.query(`SELECT * FROM council_generations WHERE request_id = $1`, [second.requestId])) as Record<string, unknown>[];
  expect(row).toMatchObject({ status: 'done', prompt_tokens: 10, completion_tokens: 5, cost_micro_usd: '3', reserved_micro_usd: '0', model: 'db-check' });
  expect(Object.keys(row).sort()).toEqual(
    ['action', 'completion_tokens', 'cookie_hash', 'cost_micro_usd', 'created_at', 'finished_at', 'ip_hash', 'model', 'prompt_tokens', 'request_id', 'reserved_micro_usd', 'status', 'thread_id'].sort(),
  );
});
