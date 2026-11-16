import { readFileSync, writeFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { afterAll, expect, test } from 'vitest';
import { SEAT_BRIEFS } from '@/data/council/briefs';
import { SEATS } from '@/data/council/seats';
import { STARTERS } from '@/data/council/starters';
import { readConfig } from '@/lib/council/config';
import { CouncilEvent, CouncilRequest, CouncilStatus, TranscriptTurn } from '@/lib/council/contract';
import { EngineDeps, handleGenerate, handleStatus } from '@/lib/council/engine';
import { NeonCouncilStore } from '@/lib/council/neonStore';
import { createOpenRouterProvider } from '@/lib/council/openrouter';

// End-to-end smoke test of the real thing: real config from .env.local, the
// real database, the real model. It drives the same handlers the route calls,
// as one made-up visitor, through a whole day's allowance:
//
//   open -> follow-up -> thread_limit -> open -> open -> visitor_limit
//   then one request that is aborted mid-stream
//
// That is 5 paid model calls (well under one cent in total). Rows it creates
// are deleted afterwards, by request id. Opt in with:
//
//   COUNCIL_SMOKE=1 npx vitest run --config scripts/council-live.vitest.config.mts council-smoke
//
// COUNCIL_SMOKE_OUT=/some/file.txt also writes the transcript of the run there.

const enabled = process.env.COUNCIL_SMOKE === '1';

// .env.local wins over the shell, so a stale exported key cannot shadow it.
function localEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const requestIds: string[] = [];
const log: string[] = [];
const say = (line: string) => log.push(line);

interface Reply {
  status: number;
  events: { atMs: number; event: CouncilEvent }[];
  cookie: string | null;
}

function request(body: Partial<CouncilRequest>, who: { ip: string; cookie: string | null }, signal?: AbortSignal): Request {
  const requestId = crypto.randomUUID();
  requestIds.push(requestId);
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-forwarded-for': who.ip };
  if (who.cookie) headers.cookie = who.cookie;
  return new Request('http://localhost:3000/api/council', { method: 'POST', headers, body: JSON.stringify({ requestId, transcript: [], ...body }), signal });
}

async function send(deps: EngineDeps, label: string, body: Partial<CouncilRequest>, who: { ip: string; cookie: string | null }): Promise<Reply> {
  const started = Date.now();
  const { response, settled } = await handleGenerate(request(body, who), deps);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const events: Reply['events'] = [];
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      events.push({ atMs: Date.now() - started, event: JSON.parse(buffer.slice(0, newline)) });
      buffer = buffer.slice(newline + 1);
    }
  }
  if (buffer.trim()) events.push({ atMs: Date.now() - started, event: JSON.parse(buffer) });
  await settled;

  say(`\n## ${label}: HTTP ${response.status} ${response.headers.get('content-type')}`);
  let deltas = 0;
  for (const { atMs, event } of events) {
    if (event.type === 'delta') {
      deltas += 1;
      continue;
    }
    if (deltas > 0) say(`         ... ${deltas} delta events`);
    deltas = 0;
    const shown = event.type === 'session' ? { ...event, threadToken: `${event.threadToken.slice(0, 12)}...` } : event;
    say(`${String(atMs).padStart(6)}ms ${JSON.stringify(shown)}`);
  }
  const setCookie = response.headers.get('set-cookie');
  return { status: response.status, events, cookie: setCookie ? setCookie.split(';')[0] : null };
}

function turnsOf(reply: Reply): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  for (const { event } of reply.events) {
    if (event.type === 'turn_start') turns.push({ id: event.turnId, role: event.role, seatId: event.seatId, text: '' });
    if (event.type === 'delta') turns.find((t) => t.id === event.turnId)!.text += event.text;
  }
  return turns;
}

const first = <T extends CouncilEvent['type']>(reply: Reply, type: T) =>
  reply.events.map((e) => e.event).find((e): e is Extract<CouncilEvent, { type: T }> => e.type === type);

afterAll(async () => {
  if (!enabled) return;
  const env = localEnv();
  if (env.DATABASE_URL && requestIds.length > 0) {
    const sql = neon(env.DATABASE_URL);
    const rows = (await sql.query(
      `SELECT action, status, prompt_tokens, completion_tokens, cost_micro_usd, reserved_micro_usd FROM council_generations WHERE request_id = ANY($1) ORDER BY created_at`,
      [requestIds],
    )) as Record<string, unknown>[];
    say('\n## rows this run wrote (then deleted)');
    for (const row of rows) say(JSON.stringify(row));
    await sql.query(`DELETE FROM council_generations WHERE request_id = ANY($1)`, [requestIds]);
  }
  if (process.env.COUNCIL_SMOKE_OUT) writeFileSync(process.env.COUNCIL_SMOKE_OUT, log.join('\n'));
});

test.skipIf(!enabled)('a visitor uses up a whole allowance against the real services', async () => {
  const config = readConfig(localEnv());
  expect(config.live, 'needs OPENROUTER_API_KEY, COUNCIL_SECRET and DATABASE_URL in .env.local').toBe(true);
  expect(config.devUnlimited).toBe(false);
  const deps: EngineDeps = {
    config,
    store: new NeonCouncilStore(config.databaseUrl!, config.model),
    provider: createOpenRouterProvider({ apiKey: config.apiKey!, model: config.model, reasoningEffort: config.reasoningEffort, siteUrl: config.siteUrl }),
    content: { seats: SEATS, briefs: SEAT_BRIEFS },
    starterIds: STARTERS.map((s) => s.id),
    log: (event, detail) => say(`[log] ${event} ${JSON.stringify(detail ?? {})}`),
  };
  // A documentation-range address nobody else will share.
  const who = { ip: `192.0.2.${10 + Math.floor(Math.random() * 200)}`, cookie: null as string | null };
  const question = 'I was offered a promotion that means managing my closest friend at work. Do I take it?';

  // 1. A council-routed opening, streamed.
  const opening = await send(deps, 'open (council routes)', { action: 'open', question }, who);
  who.cookie = opening.cookie;
  expect(opening.status).toBe(200);
  const kinds = opening.events.map((e) => e.event.type);
  expect(kinds[0]).toBe('session');
  expect(kinds[1]).toBe('routing');
  expect(kinds.at(-1)).toBe('done');
  const routed = first(opening, 'routing')!.seatIds;
  const openingTurns = turnsOf(opening);
  expect(openingTurns.map((t) => t.seatId)).toEqual(routed);
  expect(first(opening, 'session')).toMatchObject({ exchangesLeft: 1, visitorLeft: 3 });
  // Streaming, not one flush at the end: text is arriving well before `done`.
  const firstDelta = opening.events.find((e) => e.event.type === 'delta')!.atMs;
  const done = opening.events.at(-1)!.atMs;
  expect(opening.events.filter((e) => e.event.type === 'delta').length).toBeGreaterThan(10);
  expect(done - firstDelta).toBeGreaterThan(500);
  for (const turn of openingTurns) say(`\n[${turn.seatId}] ${turn.text}`);

  // 2. One follow-up on the same thread.
  const token = first(opening, 'session')!.threadToken;
  const target = openingTurns[0];
  const followUp = await send(
    deps,
    `push_back on ${target.seatId}`,
    { action: 'push_back', question, seatIds: [target.seatId!], targetTurnId: target.id, text: 'She is the one who told me to apply, so I do not think she would resent it.', transcript: openingTurns, threadToken: token },
    who,
  );
  expect(followUp.status).toBe(200);
  expect(first(followUp, 'session')).toMatchObject({ exchangesLeft: 0, visitorLeft: 2 });
  expect(turnsOf(followUp).map((t) => t.seatId)).toEqual([target.seatId]);
  say(`\n[${target.seatId}, answering the objection] ${turnsOf(followUp)[0].text}`);

  // 3. The thread is spent.
  const third = await send(deps, 'third request on the thread', { action: 'say_more', question, seatIds: [target.seatId!], transcript: openingTurns, threadToken: first(followUp, 'session')!.threadToken }, who);
  expect(third.status).toBe(429);
  expect(first(third, 'error')).toMatchObject({ code: 'thread_limit' });

  // 4. Two more openings use up the day.
  for (const seat of ['absurdist', 'advaita'] as const) {
    const reply = await send(deps, `open (${seat} only)`, { action: 'open', question: 'Can I want more and still be content?', seatIds: [seat] }, who);
    expect(reply.status).toBe(200);
    expect(turnsOf(reply).map((t) => t.seatId)).toEqual([seat]);
    say(`\n[${seat}] ${turnsOf(reply)[0].text}`);
  }

  // 5. The fifth is refused, with a reset time, and GET agrees.
  const fifth = await send(deps, 'fifth generation today', { action: 'open', question }, who);
  expect(fifth.status).toBe(429);
  expect(first(fifth, 'error')).toMatchObject({ code: 'visitor_limit' });
  expect(first(fifth, 'error')!.resetAt).toMatch(/^\d{4}-\d\d-\d\dT/);
  const withoutCookie = await send(deps, 'fifth again, cookies cleared', { action: 'open', question }, { ...who, cookie: null });
  expect(first(withoutCookie, 'error')).toMatchObject({ code: 'visitor_limit' });
  const statusResponse = await handleStatus(new Request('http://localhost:3000/api/council', { headers: { 'x-forwarded-for': who.ip, cookie: who.cookie! } }), deps);
  const status = (await statusResponse.json()) as CouncilStatus;
  say(`\n## GET status: ${JSON.stringify(status)}`);
  expect(status).toMatchObject({ live: true, visitorLeft: 0 });

  // 6. A different visitor disconnects mid-stream: upstream stops, usage is still written.
  const other = { ip: `198.51.100.${10 + Math.floor(Math.random() * 200)}`, cookie: null };
  const client = new AbortController();
  const started = Date.now();
  const aborted = await handleGenerate(request({ action: 'open', question }, other, client.signal), deps);
  const abortedId = requestIds.at(-1)!;
  const reader = aborted.response.body!.getReader();
  const decoder = new TextDecoder();
  let seen = '';
  while (!seen.includes('"delta"')) seen += decoder.decode((await reader.read()).value);
  const abortAt = Date.now();
  client.abort();
  await aborted.settled;
  say(`\n## abort: first text after ${abortAt - started}ms, client left, usage settled ${Date.now() - abortAt}ms later`);
  expect(Date.now() - abortAt).toBeLessThan(3000);
  const sql = neon(config.databaseUrl!);
  const [row] = (await sql.query(`SELECT status, prompt_tokens, completion_tokens, cost_micro_usd, reserved_micro_usd FROM council_generations WHERE request_id = $1`, [abortedId])) as Record<string, unknown>[];
  expect(row).toMatchObject({ status: 'done', reserved_micro_usd: '0' });
  expect(Number(row.prompt_tokens)).toBeGreaterThan(0);
  // Cut off early, so far fewer tokens than a full three-seat opening.
  expect(Number(row.completion_tokens)).toBeLessThan(200);
});
