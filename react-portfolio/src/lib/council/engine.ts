import { CouncilConfig, FIRST_TOKEN_TIMEOUT_MS, TOTAL_TIMEOUT_MS, costMicroUsd, estimateTokens, tokenWeight, worstCaseHoldMicroUsd } from './config';
import { COUNCIL_LIMITS, CouncilErrorCode, CouncilEvent, CouncilStatus } from './contract';
import {
  THREAD_TTL_MS,
  clientIp,
  hashIp,
  hashVisitorId,
  mintVisitorId,
  newThreadId,
  readVisitorCookie,
  serializeVisitorCookie,
  signThreadToken,
  starterThreadId,
  verifyThreadToken,
  visitorCookieValue,
} from './identity';
import { BuiltPrompt, PromptContent, REPAIR_NOTE, buildPrompt } from './prompt';
import { ModelProvider, ProviderError } from './provider';
import { CouncilStore, QuotaLimits, ReserveRefusal, SettleInput, Standing, VISITOR_DAILY_FAILURES } from './store';
import { CouncilStreamParser, ParsePlan } from './streamParser';
import { validateCouncilRequest } from './validate';

// The whole request lifecycle, free of Next.js so it can be driven end to end
// in tests with an in-memory store and a scripted provider:
//
//   validate -> identify -> reserve quota -> stream -> settle
//
// Nothing the visitor typed and nothing the model wrote is ever logged or
// stored. Log lines carry codes and numbers only.

const MAX_BODY_BYTES = 64 * 1024;
const MAX_CHARS_AFTER_END = 48;
const CREDENTIALS_HINT =
  'The provider rejected OPENROUTER_API_KEY or the account has no credit. Locally, a key exported by your shell overrides the one in .env.local.';

export interface EngineDeps {
  config: CouncilConfig;
  store: CouncilStore | null;
  provider: ModelProvider | null;
  content: PromptContent;
  starterIds: readonly string[];
  now?: () => number;
  newTurnId?: () => string;
  timeouts?: { firstTokenMs: number; totalMs: number };
  log?: (event: string, detail?: Record<string, string | number | boolean | null>) => void;
}

export interface GenerateResult {
  response: Response;
  /** Resolves when usage has been reconciled. Never rejects. */
  settled: Promise<void>;
}

const defaultLog: NonNullable<EngineDeps['log']> = (event, detail) => {
  console.error('[council]', event, detail ?? {});
};

const STATUS_BY_CODE: Record<CouncilErrorCode, number> = {
  invalid_request: 400,
  thread_limit: 429,
  visitor_limit: 429,
  busy: 429,
  budget_exhausted: 503,
  live_disabled: 503,
  provider_error: 503,
  timeout: 503,
};

const MESSAGE_BY_CODE: Record<CouncilErrorCode, string> = {
  invalid_request: 'That request could not be read.',
  thread_limit: 'This question has used its exchanges. Start a new one.',
  visitor_limit: 'You have used today’s live replies.',
  busy: 'A reply for this thread is still in progress.',
  budget_exhausted: 'The council has reached its limit for today.',
  live_disabled: 'Live replies are off right now.',
  provider_error: 'The council could not reply. Try again.',
  timeout: 'That took too long. Try again.',
};

// Codes for which trying again could ever work. Whether it is offered for a
// particular failure also depends on what that failure cost: see errorEvent.
const TRANSIENT: ReadonlySet<CouncilErrorCode> = new Set(['busy', 'provider_error', 'timeout']);

type ErrorEvent = Extract<CouncilEvent, { type: 'error' }>;

interface ErrorDetail {
  message?: string;
  /** Where the visitor and thread stand now, when known. */
  standing?: Partial<Standing> | null;
  /** This exchange was used up: text was shown, or the visitor stopped it. */
  charged?: boolean;
}

/**
 * `retryable` is true only when a retry can actually succeed: the failure
 * was transient, this exchange was not charged, and the visitor and thread
 * both still have something left.
 */
function errorEvent(code: CouncilErrorCode, detail: ErrorDetail = {}): ErrorEvent {
  const standing = detail.standing ?? {};
  const spent = standing.exchangesLeft === 0 || standing.visitorLeft === 0;
  const event: ErrorEvent = {
    type: 'error',
    code,
    message: detail.message ?? MESSAGE_BY_CODE[code],
    retryable: TRANSIENT.has(code) && !detail.charged && !(spent && code !== 'busy'),
  };
  if (standing.exchangesLeft !== undefined) event.exchangesLeft = standing.exchangesLeft;
  if (standing.visitorLeft !== undefined) event.visitorLeft = standing.visitorLeft;
  if (standing.resetAt !== undefined && (code === 'visitor_limit' || code === 'budget_exhausted' || standing.visitorLeft === 0)) {
    event.resetAt = standing.resetAt;
  }
  return event;
}

function jsonResponse(body: unknown, status: number, setCookie: string | null): Response {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  if (setCookie) headers.set('Set-Cookie', setCookie);
  return new Response(JSON.stringify(body), { status, headers });
}

function refuse(code: CouncilErrorCode, setCookie: string | null, detail: ErrorDetail = {}): GenerateResult {
  return { response: jsonResponse(errorEvent(code, detail), STATUS_BY_CODE[code], setCookie), settled: Promise.resolve() };
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

interface Visitor {
  ipHash: string;
  cookieHash: string;
  /** Set-Cookie value when this request had no valid visitor cookie. */
  setCookie: string | null;
}

function identify(request: Request, config: CouncilConfig, secret: string): Visitor {
  const ipHash = hashIp(secret, clientIp(request.headers));
  let visitorId = readVisitorCookie(secret, request.headers.get('cookie'));
  let setCookie: string | null = null;
  if (!visitorId) {
    visitorId = mintVisitorId();
    setCookie = serializeVisitorCookie(visitorCookieValue(secret, visitorId), config.secureCookies);
  }
  return { ipHash, cookieHash: hashVisitorId(secret, visitorId), setCookie };
}

function limitsFor(config: CouncilConfig): QuotaLimits {
  return {
    threadExchanges: COUNCIL_LIMITS.exchangesPerThread,
    visitorDaily: COUNCIL_LIMITS.visitorDailyGenerations,
    visitorDailyFailures: VISITOR_DAILY_FAILURES,
    siteDailyGenerations: config.dailyGenerations,
    siteDailyBudgetMicroUsd: config.dailyBudgetMicroUsd,
    holdMicroUsd: worstCaseHoldMicroUsd(config.price),
    skipVisitorCap: config.devUnlimited,
  };
}

/**
 * A browser on another site can POST here without a preflight only by lying
 * about the content type, and it always sends Origin. Requiring JSON and a
 * same-host Origin stops a third-party page from spending this site's budget
 * through its own visitors (who would each arrive with a fresh IP).
 */
function isForeignBrowserRequest(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return true;
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// GET: status
// ---------------------------------------------------------------------------

export async function handleStatus(request: Request, deps: EngineDeps): Promise<Response> {
  const { config, store } = deps;
  // Off for everyone, and nothing was looked up, so no claim about usage.
  const off: CouncilStatus = { live: false, offReason: 'live_disabled', visitorLeft: COUNCIL_LIMITS.visitorDailyGenerations, resetAt: null };
  if (!config.live || !config.secret || !store || !deps.provider) return jsonResponse(off, 200, null);

  const visitor = identify(request, config, config.secret);
  try {
    const status = await store.status({ ipHash: visitor.ipHash, cookieHash: visitor.cookieHash, limits: limitsFor(config) });
    // The site-wide ceiling is judged exactly as a reservation would judge
    // it, so GET never offers what POST would refuse.
    const body: CouncilStatus = status.siteOpen
      ? { live: true, visitorLeft: status.visitorLeft, resetAt: status.resetAt }
      : { live: false, offReason: 'budget_exhausted', visitorLeft: status.visitorLeft, resetAt: status.siteResetAt };
    return jsonResponse(body, 200, visitor.setCookie);
  } catch {
    // Without the quota store nothing may be generated, so report it as off.
    (deps.log ?? defaultLog)('status_store_error');
    return jsonResponse(off, 200, null);
  }
}

// ---------------------------------------------------------------------------
// POST: one exchange
// ---------------------------------------------------------------------------

const REFUSAL_TO_CODE: Record<ReserveRefusal, CouncilErrorCode> = {
  duplicate_in_flight: 'busy',
  duplicate_done: 'invalid_request',
  busy: 'busy',
  thread_limit: 'thread_limit',
  visitor_limit: 'visitor_limit',
  budget_exhausted: 'budget_exhausted',
};

export async function handleGenerate(request: Request, deps: EngineDeps): Promise<GenerateResult> {
  const { config, store, provider } = deps;
  const now = deps.now ?? Date.now;
  const log = deps.log ?? defaultLog;

  if (!config.live || !config.secret || !store || !provider) return refuse('live_disabled', null);
  const secret = config.secret;

  if (!(request.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
    return refuse('invalid_request', null, { message: 'Send JSON.' });
  }
  if (isForeignBrowserRequest(request)) return refuse('invalid_request', null, { message: 'Cross-site requests are not accepted.' });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return refuse('invalid_request', null, { message: 'Request is too large.' });

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return refuse('invalid_request', null, { message: 'Request is too large.' });
    body = JSON.parse(raw);
  } catch {
    return refuse('invalid_request', null, { message: 'Request body is not valid JSON.' });
  }

  const visitor = identify(request, config, secret);
  const validation = validateCouncilRequest(body, deps.starterIds);
  if (!validation.ok) return refuse('invalid_request', visitor.setCookie, { message: validation.message });
  const plan = validation.plan;

  // Which thread is this, and how much of it is already used?
  let threadId: string;
  let threadBase: number;
  let expiresAt: number;
  if (plan.threadToken) {
    const verdict = verifyThreadToken(secret, plan.threadToken, visitor, now());
    if (!verdict.ok) {
      return verdict.reason === 'expired'
        ? refuse('thread_limit', visitor.setCookie, { message: 'This thread has expired. Start a new question.', standing: { exchangesLeft: 0 } })
        : refuse('invalid_request', visitor.setCookie, { message: 'threadToken is not valid for this visitor.' });
    }
    ({ t: threadId, b: threadBase, e: expiresAt } = verdict.claims);
  } else if (plan.starterId) {
    // A starter thread's free, scripted opening counts as its first exchange.
    // The id is derived, not random, so following up the same starter twice
    // (with the token thrown away in between) still meets the thread cap.
    // Keyed on the IP hash because that is present on every request, whereas
    // the cookie may be minted by this very one.
    threadId = starterThreadId(secret, plan.starterId, visitor.ipHash);
    threadBase = 1;
    expiresAt = now() + THREAD_TTL_MS;
  } else {
    threadId = newThreadId();
    threadBase = 0;
    expiresAt = now() + THREAD_TTL_MS;
  }

  const prompt = buildPrompt(plan, deps.content);
  if (prompt.overBudget) return refuse('invalid_request', visitor.setCookie, { message: 'That is too long to take in. Try a shorter version.' });
  const promptTokenEstimate = estimateTokens(prompt.system) + estimateTokens(prompt.user);
  const limits = limitsFor(config);

  let outcome;
  try {
    outcome = await store.reserve({
      requestId: plan.requestId,
      threadId,
      threadBase,
      ipHash: visitor.ipHash,
      cookieHash: visitor.cookieHash,
      action: plan.action,
      limits,
    });
  } catch {
    // Fail closed: no quota check, no model call.
    log('reserve_store_error');
    return refuse('provider_error', visitor.setCookie);
  }

  if (!outcome.ok) {
    const code = REFUSAL_TO_CODE[outcome.code];
    const message = outcome.code === 'duplicate_done' ? 'This requestId was already used. Send a fresh one.' : undefined;
    const { exchangesLeft, visitorLeft, resetAt } = outcome;
    return refuse(code, visitor.setCookie, { message, standing: { exchangesLeft, visitorLeft, resetAt } });
  }

  const session: CouncilEvent = {
    type: 'session',
    threadToken: signThreadToken(secret, { threadId, ipHash: visitor.ipHash, cookieHash: visitor.cookieHash, base: threadBase, expiresAt }),
    exchangesLeft: outcome.exchangesLeft,
    visitorLeft: outcome.visitorLeft,
    resetAt: outcome.resetAt,
  };

  const { body: stream, settled } = streamExchange({
    request,
    session,
    prompt,
    promptTokenEstimate,
    requestId: plan.requestId,
    report: { threadId, threadBase, ipHash: visitor.ipHash, cookieHash: visitor.cookieHash, limits },
    provider,
    store,
    config,
    log,
    newTurnId: deps.newTurnId ?? defaultTurnIds(),
    timeouts: deps.timeouts ?? { firstTokenMs: FIRST_TOKEN_TIMEOUT_MS, totalMs: TOTAL_TIMEOUT_MS },
  });

  const headers = new Headers({
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-store, no-transform',
    'X-Accel-Buffering': 'no',
    'X-Content-Type-Options': 'nosniff',
  });
  if (visitor.setCookie) headers.set('Set-Cookie', visitor.setCookie);
  return { response: new Response(stream, { status: 200, headers }), settled };
}

function defaultTurnIds(): () => string {
  const prefix = newThreadId().slice(0, 8);
  let n = 0;
  return () => `t_${prefix}_${++n}`;
}

// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------

type StopReason = 'client' | 'first_token' | 'deadline';

interface ExchangeContext {
  request: Request;
  session: CouncilEvent;
  prompt: BuiltPrompt;
  promptTokenEstimate: number;
  requestId: string;
  report: NonNullable<SettleInput['report']>;
  provider: ModelProvider;
  store: CouncilStore;
  config: CouncilConfig;
  log: NonNullable<EngineDeps['log']>;
  newTurnId: () => string;
  timeouts: { firstTokenMs: number; totalMs: number };
}

/**
 * Iterates `source` but gives up the moment `signal` aborts, even if the
 * source itself is slow to notice. The source is then told to clean up.
 */
async function* untilAborted<T>(source: AsyncIterable<T>, signal: AbortSignal): AsyncGenerator<T> {
  const iterator = source[Symbol.asyncIterator]();
  let abort!: () => void;
  const aborted = new Promise<never>((_, reject) => {
    abort = () => reject(new DOMException('The exchange was stopped.', 'AbortError'));
  });
  aborted.catch(() => {});
  if (signal.aborted) abort();
  else signal.addEventListener('abort', abort, { once: true });
  try {
    for (;;) {
      const next = await Promise.race([iterator.next(), aborted]);
      if (next.done) return;
      yield next.value;
    }
  } finally {
    signal.removeEventListener('abort', abort);
    void Promise.resolve(iterator.return?.()).catch(() => {});
  }
}

function streamExchange(ctx: ExchangeContext): { body: ReadableStream<Uint8Array>; settled: Promise<void> } {
  const { prompt, provider, config, log } = ctx;
  const encoder = new TextEncoder();
  const upstream = new AbortController();
  let stopReason: StopReason | null = null;
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let open = true;

  const stop = (reason: StopReason) => {
    if (stopReason) return;
    stopReason = reason;
    upstream.abort();
  };

  const send = (event: CouncilEvent) => {
    if (!open) return;
    try {
      controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
    } catch {
      open = false;
    }
  };

  const close = () => {
    if (!open) return;
    open = false;
    try {
      controller.close();
    } catch {
      // The client already went away.
    }
  };

  async function run(): Promise<void> {
    const onClientAbort = () => stop('client');
    if (ctx.request.signal.aborted) stop('client');
    else ctx.request.signal.addEventListener('abort', onClientAbort, { once: true });
    const deadline = setTimeout(() => stop('deadline'), ctx.timeouts.totalMs);

    let promptTokens = 0;
    let completionTokens = 0;
    let reportedMicroUsd = 0;
    // The provider took a request, so money was (or may have been) spent.
    let billed = false;
    // The visitor received reply text. Nothing else is ever sent before it:
    // the parser holds `routing` until the first section has text.
    let shown = false;
    let usable = false;
    let failure: 'provider_error' | 'timeout' | 'live_disabled' | null = null;

    const emit = (event: CouncilEvent) => {
      if (event.type === 'delta') shown = true;
      send(event);
    };

    try {
      send(ctx.session);
      // At most two attempts: the real one, and one repair if the first
      // produced nothing usable (in which case nothing has been sent).
      for (let attempt = 0; attempt < 2 && !stopReason; attempt++) {
        // Last chance: if the repair is prose with no markers either, show it
        // as one note in the council's voice. The visitor is paying for this
        // generation and should get what there is.
        const lastResort = attempt === 1 && !prompt.parsePlan.fallback;
        const parsePlan: ParsePlan = lastResort ? { ...prompt.parsePlan, fallback: { role: 'synthesis' } } : prompt.parsePlan;
        const parser = new CouncilStreamParser(parsePlan, { newTurnId: ctx.newTurnId });
        const generation = provider.stream({
          system: attempt === 0 ? prompt.system : `${prompt.system}\n\n${REPAIR_NOTE}`,
          user: prompt.user,
          maxTokens: prompt.maxTokens,
          stop: ['@@END'],
          signal: upstream.signal,
        });
        const firstToken = setTimeout(() => stop('first_token'), ctx.timeouts.firstTokenMs);
        let received = false;
        let receivedTokens = 0;
        let charsAfterEnd = 0;
        let completed = false;
        try {
          for await (const chunk of untilAborted(generation.chunks, upstream.signal)) {
            if (!received) clearTimeout(firstToken);
            received = true;
            receivedTokens += tokenWeight(chunk);
            // Some models keep writing after @@END (one repeated its whole
            // answer). A little slack lets the usage report arrive; past
            // that, hang up so the extra tokens are not generated or billed.
            if (parser.finished && (charsAfterEnd += chunk.length) > MAX_CHARS_AFTER_END) break;
            for (const event of parser.push(chunk)) emit(event);
          }
          completed = true;
          for (const event of parser.end()) emit(event);
        } finally {
          clearTimeout(firstToken);
          const usage = generation.usage();
          if (usage) {
            billed = true;
            promptTokens += usage.promptTokens;
            completionTokens += usage.completionTokens;
            reportedMicroUsd += Math.ceil((usage.reportedCostUsd ?? 0) * 1_000_000);
          } else if (completed || received || generation.accepted()) {
            // The provider took the request but never reported usage (cut
            // off, or it just did not say): estimate, high.
            billed = true;
            promptTokens += ctx.promptTokenEstimate;
            completionTokens += Math.ceil(receivedTokens);
          }
        }
        if (parser.turnCount > 0) {
          usable = true;
          break;
        }
        log('unusable_output', { attempt });
        if (attempt === 1) failure = 'provider_error';
      }
      // Stopped by a timer between attempts, with nothing to show for it.
      if (!usable && !failure && stopReason && stopReason !== 'client') failure = 'timeout';
    } catch (err) {
      if (stopReason === 'first_token' || stopReason === 'deadline') {
        failure = 'timeout';
        log('timeout', { stage: stopReason, shown });
      } else if (stopReason !== 'client') {
        const known = err instanceof ProviderError ? err : null;
        // A rejected key or an empty balance will not fix itself on retry:
        // tell the client live replies are off instead of inviting one.
        const refused = known?.kind === 'http' && [401, 402, 403].includes(known.status ?? 0);
        failure = refused && !shown ? 'live_disabled' : 'provider_error';
        log('provider_error', { kind: known?.kind ?? 'unexpected', status: known?.status ?? null, shown });
        if (refused) log('provider_refused_credentials', { hint: CREDENTIALS_HINT });
      }
    } finally {
      clearTimeout(deadline);
      ctx.request.signal.removeEventListener('abort', onClientAbort);
    }

    // Settle before the last event is written, so that event can tell the
    // truth about what is left, and so the thread is free by the time the
    // client hears it is over.
    //
    // charged: text was shown, or the visitor stopped or left. It is their
    // exchange. Otherwise the failure was ours and the thread gets its
    // exchange back; if the provider billed us, the row still counts against
    // the visitor's daily allowance (see store.ts), so a model that keeps
    // returning nothing usable cannot be looped for free.
    const charged = shown || failure === null;
    const computed = Math.max(costMicroUsd(config.price, promptTokens, completionTokens), reportedMicroUsd);
    let standing: Standing | null = null;
    try {
      standing = await ctx.store.settle({
        requestId: ctx.requestId,
        outcome: charged ? 'done' : 'released',
        promptTokens,
        completionTokens,
        // A billed request is never recorded as free, however small.
        costMicroUsd: billed ? Math.max(1, computed) : computed,
        report: failure ? ctx.report : undefined,
      });
    } catch {
      // The row stays reserved: still counted, still holding its budget.
      log('settle_store_error');
    }

    if (failure) send(errorEvent(failure, { standing, charged }));
    else if (stopReason !== 'client') send({ type: 'done' });
    close();
  }

  let settled!: Promise<void>;
  const body = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
      settled = run().catch(() => {
        log('stream_crash');
        close();
      });
    },
    cancel() {
      open = false;
      stop('client');
    },
  });
  return { body, settled };
}
