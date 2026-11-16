import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryCouncilStore } from './memoryStore';
import { DAY_MS, IN_FLIGHT_MS, QuotaLimits, RETENTION_MS, ReserveInput, ReserveOutcome, nextUtcMidnight } from './store';

const LIMITS: QuotaLimits = {
  threadExchanges: 2,
  visitorDaily: 4,
  visitorDailyFailures: 4,
  siteDailyGenerations: 150,
  siteDailyBudgetMicroUsd: 1_000_000,
  holdMicroUsd: 2_000,
  skipVisitorCap: false,
};

const START = Date.UTC(2026, 10, 16, 9, 0, 0);
let clock = START;
let store: MemoryCouncilStore;
let counter = 0;

beforeEach(() => {
  clock = START;
  counter = 0;
  store = new MemoryCouncilStore(() => clock);
});

type Over = Omit<Partial<ReserveInput>, 'limits'> & { limits?: Partial<QuotaLimits> };

function input(over: Over = {}): ReserveInput {
  counter += 1;
  const { limits, ...rest } = over;
  return {
    requestId: `req-${counter}`,
    threadId: `thread-${counter}`,
    threadBase: 0,
    ipHash: 'ip-a',
    cookieHash: 'cookie-a',
    action: 'open',
    ...rest,
    limits: { ...LIMITS, ...limits },
  };
}

type Ending = 'done' | 'released-billed' | 'released-free';

/** Reserve and, if admitted, settle the way a request of that kind would. */
async function generate(over: Over = {}, cost = 800, ending: Ending = 'done'): Promise<ReserveOutcome> {
  const request = input(over);
  const outcome = await store.reserve(request);
  if (outcome.ok) {
    await store.settle({
      requestId: request.requestId,
      outcome: ending === 'done' ? 'done' : 'released',
      promptTokens: ending === 'released-free' ? 0 : 4000,
      completionTokens: ending === 'released-free' ? 0 : 400,
      costMicroUsd: ending === 'released-free' ? 0 : cost,
    });
  }
  return outcome;
}

const who = { ipHash: 'ip-a', cookieHash: 'cookie-a' };
const okCount = (outcomes: ReserveOutcome[]) => outcomes.filter((o) => o.ok).length;
const codes = (outcomes: ReserveOutcome[]) => outcomes.map((o) => (o.ok ? 'ok' : o.code));

describe('thread cap', () => {
  it('allows two exchanges on a thread, then refuses', async () => {
    expect(await generate({ threadId: 't' })).toMatchObject({ ok: true, exchangesLeft: 1 });
    expect(await generate({ threadId: 't', action: 'say_more' })).toMatchObject({ ok: true, exchangesLeft: 0 });
    expect(await generate({ threadId: 't', action: 'differ' })).toMatchObject({ ok: false, code: 'thread_limit', exchangesLeft: 0, visitorLeft: 2 });
  });

  it('counts a starter thread’s free opening as its first exchange', async () => {
    expect(await generate({ threadId: 't', threadBase: 1, action: 'push_back' })).toMatchObject({ ok: true, exchangesLeft: 0 });
    expect(await generate({ threadId: 't', threadBase: 1, action: 'say_more' })).toMatchObject({ ok: false, code: 'thread_limit' });
  });

  it('refuses a second request on a thread while the first is in flight', async () => {
    expect((await store.reserve(input({ threadId: 't' }))).ok).toBe(true);
    expect(await store.reserve(input({ threadId: 't' }))).toMatchObject({ ok: false, code: 'busy' });
  });

  it('stops treating a crashed reservation as in flight, but keeps counting it', async () => {
    await store.reserve(input({ threadId: 't' }));
    clock += IN_FLIGHT_MS + 1;
    expect(await store.reserve(input({ threadId: 't' }))).toMatchObject({ ok: true, exchangesLeft: 0 });
    clock += IN_FLIGHT_MS + 1;
    expect(await store.reserve(input({ threadId: 't' }))).toMatchObject({ ok: false, code: 'thread_limit' });
  });
});

describe('visitor cap, rolling 24 hours', () => {
  it('allows four generations across threads and reports what is left', async () => {
    const left: number[] = [];
    for (let i = 0; i < 4; i++) {
      const outcome = await generate();
      expect(outcome.ok).toBe(true);
      left.push(outcome.visitorLeft);
      clock += 60_000;
    }
    expect(left).toEqual([3, 2, 1, 0]);
  });

  it('refuses the fifth with the time the oldest one leaves the window', async () => {
    for (let i = 0; i < 4; i++) {
      await generate();
      clock += 60 * 60_000;
    }
    expect(await generate()).toEqual({ ok: false, code: 'visitor_limit', exchangesLeft: 2, visitorLeft: 0, resetAt: new Date(START + DAY_MS).toISOString() });
  });

  it('frees one slot at a time as generations age out', async () => {
    for (let i = 0; i < 4; i++) {
      await generate();
      clock += 60 * 60_000;
    }
    clock = START + DAY_MS - 1;
    expect((await generate()).ok).toBe(false);
    clock = START + DAY_MS + 1;
    expect(await generate()).toMatchObject({ ok: true, visitorLeft: 0 });
    expect(await generate()).toMatchObject({ ok: false, code: 'visitor_limit', resetAt: new Date(START + 60 * 60_000 + DAY_MS).toISOString() });
  });

  it('applies when EITHER identifier is over: clearing cookies does not reset it', async () => {
    for (let i = 0; i < 4; i++) await generate({ ipHash: 'ip-a', cookieHash: 'cookie-a' });
    expect(await generate({ ipHash: 'ip-a', cookieHash: 'cookie-fresh' })).toMatchObject({ ok: false, code: 'visitor_limit' });
  });

  it('applies when EITHER identifier is over: changing network does not reset it', async () => {
    for (let i = 0; i < 4; i++) await generate({ ipHash: `ip-${i}`, cookieHash: 'cookie-a' });
    expect(await generate({ ipHash: 'ip-new', cookieHash: 'cookie-a' })).toMatchObject({ ok: false, code: 'visitor_limit' });
  });

  it('does not charge one visitor for another', async () => {
    for (let i = 0; i < 4; i++) await generate({ ipHash: 'ip-a', cookieHash: 'cookie-a' });
    expect(await generate({ ipHash: 'ip-b', cookieHash: 'cookie-b' })).toMatchObject({ ok: true, visitorLeft: 3 });
  });

  it('counts in-flight reservations, so parallel threads cannot dodge it', async () => {
    for (let i = 0; i < 4; i++) expect((await store.reserve(input())).ok).toBe(true);
    expect(await store.reserve(input())).toMatchObject({ ok: false, code: 'visitor_limit' });
  });
});

describe('releasing a reservation', () => {
  it('gives the thread its exchange back either way', async () => {
    expect((await generate({ threadId: 't' }, 500, 'released-billed')).ok).toBe(true);
    expect((await generate({ threadId: 't' }, 0, 'released-free')).ok).toBe(true);
    expect(await generate({ threadId: 't' })).toMatchObject({ ok: true, exchangesLeft: 1 });
  });

  it('keeps charging the visitor when the provider was paid: a model that returns nothing cannot be looped', async () => {
    for (let i = 0; i < 4; i++) expect((await generate({}, 500, 'released-billed')).ok).toBe(true);
    expect(await generate()).toMatchObject({ ok: false, code: 'visitor_limit', visitorLeft: 0 });
    expect(await store.status({ ...who, limits: LIMITS })).toMatchObject({ visitorLeft: 0 });
    // Clearing cookies does not get around it.
    expect(await generate({ cookieHash: 'cookie-fresh' })).toMatchObject({ ok: false, code: 'visitor_limit' });
  });

  it('keeps counting a paid release against the site generation ceiling', async () => {
    const limits = { siteDailyGenerations: 2 };
    await generate({ ipHash: 'ip-1', cookieHash: 'c-1', limits }, 500, 'released-billed');
    await generate({ ipHash: 'ip-2', cookieHash: 'c-2', limits }, 500, 'released-billed');
    expect(await generate({ ipHash: 'ip-3', cookieHash: 'c-3', limits })).toMatchObject({ ok: false, code: 'budget_exhausted' });
  });

  it('does not charge the visitor or the site for a failure that cost nothing', async () => {
    const limits = { siteDailyGenerations: 1 };
    expect((await generate({ limits }, 0, 'released-free')).ok).toBe(true);
    expect(await generate({ limits })).toMatchObject({ ok: true, visitorLeft: 3 });
  });

  it('allows only a few free failures per visitor per 24 hours, then refuses until the first one ages out', async () => {
    for (let i = 0; i < 4; i++) {
      expect((await generate({}, 0, 'released-free')).ok).toBe(true);
      clock += 60_000;
    }
    expect(await generate()).toEqual({ ok: false, code: 'visitor_limit', exchangesLeft: 2, visitorLeft: 0, resetAt: new Date(START + DAY_MS).toISOString() });
    expect(await generate({ cookieHash: 'cookie-fresh' })).toMatchObject({ ok: false, code: 'visitor_limit' });
    expect(await generate({ ipHash: 'ip-other', cookieHash: 'cookie-other' })).toMatchObject({ ok: true });
    clock = START + DAY_MS + 1;
    expect(await generate()).toMatchObject({ ok: true, visitorLeft: 3 });
  });

  it('reports the standing after settlement when asked', async () => {
    const request = input({ threadId: 't' });
    await store.reserve(request);
    const report = { ...who, threadId: 't', threadBase: 0, limits: LIMITS };
    const free = await store.settle({ requestId: request.requestId, outcome: 'released', promptTokens: 0, completionTokens: 0, costMicroUsd: 0, report });
    expect(free).toMatchObject({ exchangesLeft: 2, visitorLeft: 4 });

    const second = input({ threadId: 't' });
    await store.reserve(second);
    const billed = await store.settle({ requestId: second.requestId, outcome: 'released', promptTokens: 4000, completionTokens: 0, costMicroUsd: 500, report });
    expect(billed).toMatchObject({ exchangesLeft: 2, visitorLeft: 3 });

    const third = input({ threadId: 't' });
    await store.reserve(third);
    const done = await store.settle({ requestId: third.requestId, outcome: 'done', promptTokens: 4000, completionTokens: 300, costMicroUsd: 600, report });
    expect(done).toMatchObject({ exchangesLeft: 1, visitorLeft: 2 });
    expect(await store.settle({ requestId: 'unknown', outcome: 'done', promptTokens: 0, completionTokens: 0, costMicroUsd: 0 })).toBeNull();
  });

  it('ignores a settle for a request that is not reserved', async () => {
    await generate({ requestId: 'done-once' }, 500);
    await store.settle({ requestId: 'done-once', outcome: 'released', promptTokens: 0, completionTokens: 0, costMicroUsd: 9_999 });
    await store.settle({ requestId: 'never-existed', outcome: 'done', promptTokens: 0, completionTokens: 0, costMicroUsd: 9_999 });
    expect(store.rows.get('done-once')).toMatchObject({ status: 'done', costMicroUsd: 500 });
    expect(store.rows.size).toBe(1);
  });
});

describe('site-wide daily ceilings', () => {
  it('stops at the generation ceiling across all visitors, with the next UTC midnight as reset', async () => {
    const limits = { siteDailyGenerations: 3 };
    for (let i = 0; i < 3; i++) expect((await generate({ ipHash: `ip-${i}`, cookieHash: `c-${i}`, limits })).ok).toBe(true);
    expect(await generate({ ipHash: 'ip-x', cookieHash: 'c-x', limits })).toMatchObject({
      ok: false,
      code: 'budget_exhausted',
      visitorLeft: 4,
      resetAt: new Date(nextUtcMidnight(START)).toISOString(),
    });
  });

  it('stops when one more worst-case request would not fit the dollar ceiling', async () => {
    const limits = { siteDailyBudgetMicroUsd: 10_000 };
    // Each generation settles at 4,000; the next would hold 2,000 more.
    expect((await generate({ ipHash: 'ip-1', cookieHash: 'c-1', limits }, 4_000)).ok).toBe(true);
    expect((await generate({ ipHash: 'ip-2', cookieHash: 'c-2', limits }, 4_000)).ok).toBe(true);
    expect((await generate({ ipHash: 'ip-3', cookieHash: 'c-3', limits }, 4_000)).ok).toBe(true);
    expect(await generate({ ipHash: 'ip-4', cookieHash: 'c-4', limits }, 4_000)).toMatchObject({ ok: false, code: 'budget_exhausted' });
  });

  it('holds the worst case against the budget while a request is in flight', async () => {
    const limits = { siteDailyBudgetMicroUsd: 5_000 };
    expect((await store.reserve(input({ ipHash: 'ip-1', cookieHash: 'c-1', limits }))).ok).toBe(true);
    expect((await store.reserve(input({ ipHash: 'ip-2', cookieHash: 'c-2', limits }))).ok).toBe(true);
    expect(await store.reserve(input({ ipHash: 'ip-3', cookieHash: 'c-3', limits }))).toMatchObject({ ok: false, code: 'budget_exhausted' });
  });

  it('swaps the hold for the real cost on settle', async () => {
    const limits = { siteDailyBudgetMicroUsd: 5_000 };
    const first = input({ ipHash: 'ip-1', cookieHash: 'c-1', limits });
    await store.reserve(first);
    await store.settle({ requestId: first.requestId, outcome: 'done', promptTokens: 1, completionTokens: 1, costMicroUsd: 300 });
    // 300 spent, so two more 2,000 holds now fit (4,300), a third does not.
    expect((await store.reserve(input({ ipHash: 'ip-2', cookieHash: 'c-2', limits }))).ok).toBe(true);
    expect((await store.reserve(input({ ipHash: 'ip-3', cookieHash: 'c-3', limits }))).ok).toBe(true);
    expect((await store.reserve(input({ ipHash: 'ip-4', cookieHash: 'c-4', limits }))).ok).toBe(false);
  });

  it('still counts the money a released request actually spent', async () => {
    const limits = { siteDailyBudgetMicroUsd: 3_000, holdMicroUsd: 1_000 };
    await generate({ ipHash: 'ip-1', cookieHash: 'c-1', limits }, 2_500, 'released-billed');
    expect(await generate({ ipHash: 'ip-2', cookieHash: 'c-2', limits })).toMatchObject({ ok: false, code: 'budget_exhausted' });
  });

  it('resets at UTC midnight', async () => {
    const limits = { siteDailyGenerations: 1 };
    clock = Date.UTC(2026, 10, 16, 23, 59, 0);
    expect((await generate({ ipHash: 'ip-1', cookieHash: 'c-1', limits })).ok).toBe(true);
    expect((await generate({ ipHash: 'ip-2', cookieHash: 'c-2', limits })).ok).toBe(false);
    clock = Date.UTC(2026, 10, 17, 0, 0, 1);
    expect((await generate({ ipHash: 'ip-2', cookieHash: 'c-2', limits })).ok).toBe(true);
  });
});

describe('status agrees with reserve', () => {
  const stranger = { ipHash: 'ip-new', cookieHash: 'cookie-new' };

  it('reports what a visitor has left and when it next changes', async () => {
    expect(await store.status({ ...who, limits: LIMITS })).toEqual({ siteOpen: true, siteResetAt: null, visitorLeft: 4, resetAt: null });
    await generate();
    expect(await store.status({ ...who, limits: LIMITS })).toEqual({
      siteOpen: true,
      siteResetAt: null,
      visitorLeft: 3,
      resetAt: new Date(START + DAY_MS).toISOString(),
    });
  });

  it('says the site is closed, with this visitor’s own allowance intact, at the generation ceiling', async () => {
    const limits = { ...LIMITS, siteDailyGenerations: 1 };
    await generate({ ipHash: 'ip-other', cookieHash: 'c-other' });
    expect(await store.status({ ...stranger, limits })).toEqual({
      siteOpen: false,
      siteResetAt: new Date(nextUtcMidnight(START)).toISOString(),
      visitorLeft: 4,
      resetAt: null,
    });
  });

  it('never says open when a reservation would be refused, at any level of spend', async () => {
    const limits = { ...LIMITS, siteDailyBudgetMicroUsd: 20_000 };
    // Walk the spend up in small steps across the whole range, including the
    // band within one hold of the ceiling, and compare the two answers.
    for (let step = 0; step < 60; step++) {
      const status = await store.status({ ...stranger, limits });
      const probe = input({ ...stranger, requestId: `probe-${step}`, threadId: `probe-thread-${step}`, limits });
      const reserved = await store.reserve(probe);
      expect(status.siteOpen).toBe(reserved.ok);
      if (reserved.ok) await store.settle({ requestId: probe.requestId, outcome: 'released', promptTokens: 0, completionTokens: 0, costMicroUsd: 0 });
      else expect(reserved.code).toBe('budget_exhausted');
      await generate({ ipHash: `ip-${step}`, cookieHash: `c-${step}`, limits }, 450);
      // The probe was only a question. Remove it so probes never reach the failure cap.
      store.rows.delete(probe.requestId);
    }
    expect((await store.status({ ...stranger, limits })).siteOpen).toBe(false);
  });
});

describe('request id dedupe', () => {
  it('refuses a repeat while the original is in flight, without charging again', async () => {
    const request = input({ threadId: 't', requestId: 'same' });
    expect((await store.reserve(request)).ok).toBe(true);
    expect(await store.reserve({ ...request })).toMatchObject({ ok: false, code: 'duplicate_in_flight' });
    expect(store.rows.size).toBe(1);
    expect((await store.status({ ...who, limits: LIMITS })).visitorLeft).toBe(3);
  });

  it('refuses a repeat of a settled request, however it ended, so an id cannot be replayed', async () => {
    await generate({ threadId: 't', requestId: 'done' });
    await generate({ threadId: 't2', requestId: 'billed' }, 500, 'released-billed');
    await generate({ threadId: 't3', requestId: 'free' }, 0, 'released-free');
    for (const requestId of ['done', 'billed', 'free']) {
      expect(await store.reserve(input({ requestId }))).toMatchObject({ ok: false, code: 'duplicate_done' });
      expect(await store.reserve(input({ requestId, ipHash: 'ip-z', cookieHash: 'c-z' }))).toMatchObject({ ok: false, code: 'duplicate_done' });
    }
    expect(store.rows.size).toBe(3);
  });
});

describe('concurrency', () => {
  it('lets exactly four of fifty simultaneous requests from one visitor through', async () => {
    const outcomes = await Promise.all(Array.from({ length: 50 }, () => store.reserve(input())));
    expect(okCount(outcomes)).toBe(4);
    expect(new Set(codes(outcomes))).toEqual(new Set(['ok', 'visitor_limit']));
  });

  it('lets exactly one of thirty simultaneous requests on one thread through', async () => {
    const outcomes = await Promise.all(Array.from({ length: 30 }, () => store.reserve(input({ threadId: 'one-thread' }))));
    expect(okCount(outcomes)).toBe(1);
    expect(new Set(codes(outcomes))).toEqual(new Set(['ok', 'busy']));
  });

  it('never exceeds the site generation ceiling under a burst from many visitors', async () => {
    const limits = { siteDailyGenerations: 25 };
    const outcomes = await Promise.all(Array.from({ length: 200 }, (_, i) => store.reserve(input({ ipHash: `ip-${i}`, cookieHash: `c-${i}`, limits }))));
    expect(okCount(outcomes)).toBe(25);
  });

  it('never reserves past the dollar ceiling under a burst', async () => {
    const limits = { siteDailyBudgetMicroUsd: 21_000 };
    const outcomes = await Promise.all(Array.from({ length: 100 }, (_, i) => store.reserve(input({ ipHash: `ip-${i}`, cookieHash: `c-${i}`, limits }))));
    expect(okCount(outcomes)).toBe(10);
    const held = [...store.rows.values()].reduce((sum, row) => sum + row.reservedMicroUsd + row.costMicroUsd, 0);
    expect(held).toBeLessThanOrEqual(21_000);
  });

  it('holds every cap at once when reserve and settle interleave', async () => {
    const limits = { siteDailyGenerations: 30 };
    const visitors = 20;
    const attempts = Array.from({ length: 300 }, (_, i) => {
      const visitor = i % visitors;
      const request = input({ ipHash: `ip-${visitor}`, cookieHash: `c-${visitor}`, threadId: `thread-${visitor}-${i % 3}`, limits });
      return store.reserve(request).then(async (outcome) => {
        if (outcome.ok) await store.settle({ requestId: request.requestId, outcome: 'done', promptTokens: 1, completionTokens: 1, costMicroUsd: 100 });
        return { visitor, thread: request.threadId, outcome };
      });
    });
    const results = await Promise.all(attempts);
    const ok = results.filter((r) => r.outcome.ok);
    expect(ok.length).toBeLessThanOrEqual(30);
    for (let visitor = 0; visitor < visitors; visitor++) expect(ok.filter((r) => r.visitor === visitor).length).toBeLessThanOrEqual(4);
    const perThread = new Map<string, number>();
    for (const r of ok) perThread.set(r.thread, (perThread.get(r.thread) ?? 0) + 1);
    expect(Math.max(...perThread.values())).toBeLessThanOrEqual(2);
  });
});

describe('dev-only visitor cap bypass', () => {
  const limits = { skipVisitorCap: true };

  it('skips the visitor cap only', async () => {
    for (let i = 0; i < 10; i++) expect(await generate({ limits })).toMatchObject({ ok: true, visitorLeft: 4 });
  });

  it('still enforces the thread cap and the site ceilings', async () => {
    await generate({ threadId: 't', limits });
    await generate({ threadId: 't', limits });
    expect(await generate({ threadId: 't', limits })).toMatchObject({ ok: false, code: 'thread_limit' });
    expect(await generate({ limits: { ...limits, siteDailyGenerations: 2 } })).toMatchObject({ ok: false, code: 'budget_exhausted' });
  });
});

describe('retention', () => {
  it('deletes rows older than 48 hours on the next reservation', async () => {
    await generate({ requestId: 'old' });
    clock += RETENTION_MS + 1;
    await generate({ requestId: 'new', ipHash: 'ip-b', cookieHash: 'c-b' });
    expect([...store.rows.keys()]).toEqual(['new']);
  });

  it('deletes them on a status read too, so they do not wait for the next live question', async () => {
    await generate({ requestId: 'old' });
    clock += RETENTION_MS + 1;
    await store.status({ ...who, limits: LIMITS });
    expect(store.rows.size).toBe(0);
  });

  it('stores ids, counters, timestamps and token counts, and nothing else', async () => {
    await generate();
    const [row] = [...store.rows.values()];
    expect(Object.keys(row).sort()).toEqual(
      ['action', 'completionTokens', 'cookieHash', 'costMicroUsd', 'createdAt', 'finishedAt', 'ipHash', 'promptTokens', 'requestId', 'reservedMicroUsd', 'status', 'threadId'].sort(),
    );
  });
});
