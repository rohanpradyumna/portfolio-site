import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { SEAT_BRIEFS } from '@/data/council/briefs';
import { EVAL_CASES, EvalCase } from '@/data/council/evalPrompts';
import { SEATS } from '@/data/council/seats';
import { DEFAULT_MODEL, costMicroUsd, resolvePrice } from '@/lib/council/config';
import { CouncilEvent, CouncilRequest, SeatId, TranscriptTurn } from '@/lib/council/contract';
import { createOpenRouterProvider } from '@/lib/council/openrouter';
import { buildPrompt } from '@/lib/council/prompt';
import { CouncilStreamParser } from '@/lib/council/streamParser';
import { validateCouncilRequest } from '@/lib/council/validate';

// Runs cases from src/data/council/evalPrompts.ts through the real prompt
// builder, the real provider and the real stream parser, and writes what came
// back to a folder for a human to read against each case's `lookFor`.
//
// Every model call here costs money. Nothing runs unless you name the cases:
//
//   COUNCIL_EVAL_CASES=distinct-wasted-twenties,crisis-better-off-without-me \
//   COUNCIL_EVAL_MODELS=openai/gpt-6-luna \
//   COUNCIL_EVAL_OUT=/some/folder \
//   npx vitest run --config scripts/council-live.vitest.config.mts council-eval
//
// COUNCIL_EVAL_MAX_CALLS (default 12) is a hard stop per run.

// .env.local wins over the shell: a stale OPENROUTER_API_KEY exported from a
// shell profile is otherwise picked up silently and fails with a 401.
function apiKey(): string {
  const line = existsSync('.env.local')
    ? readFileSync('.env.local', 'utf8')
        .split('\n')
        .find((l) => l.startsWith('OPENROUTER_API_KEY='))
    : undefined;
  const fromFile = line?.slice('OPENROUTER_API_KEY='.length).trim().replace(/^["']|["']$/g, '');
  const key = fromFile || process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY is not set');
  return key;
}

const content = { seats: SEATS, briefs: SEAT_BRIEFS };
const outDir = process.env.COUNCIL_EVAL_OUT || join(tmpdir(), 'council-eval');
const models = (process.env.COUNCIL_EVAL_MODELS || DEFAULT_MODEL).split(',').map((s) => s.trim()).filter(Boolean);
const caseIds = (process.env.COUNCIL_EVAL_CASES || '').split(',').map((s) => s.trim()).filter(Boolean);
const maxCalls = Number(process.env.COUNCIL_EVAL_MAX_CALLS || 12);
const effort = process.env.COUNCIL_REASONING_EFFORT ?? 'none';
let calls = 0;

interface Exchange {
  label: string;
  events: CouncilEvent[];
  raw: string;
  firstTokenMs: number | null;
  totalMs: number;
  promptTokens: number;
  completionTokens: number;
  costMicroUsd: number;
  reportedCostUsd: number | null;
  systemChars: number;
}

async function exchange(model: string, label: string, request: CouncilRequest): Promise<Exchange> {
  if (calls >= maxCalls) throw new Error(`COUNCIL_EVAL_MAX_CALLS (${maxCalls}) reached`);
  calls += 1;
  appendFileSync(join(outDir, 'calls.log'), `${new Date().toISOString()} ${model} ${label}\n`);

  const validation = validateCouncilRequest(request, []);
  if (!validation.ok) throw new Error(`eval request rejected: ${validation.message}`);
  const prompt = buildPrompt(validation.plan, content);
  const provider = createOpenRouterProvider({ apiKey: apiKey(), model, reasoningEffort: effort === 'default' ? null : effort, siteUrl: 'https://localhost' });
  let n = 0;
  const parser = new CouncilStreamParser(prompt.parsePlan, { newTurnId: () => `${label}-${++n}` });
  const events: CouncilEvent[] = [];
  let raw = '';
  let firstTokenMs: number | null = null;
  const started = Date.now();
  const generation = provider.stream({ system: prompt.system, user: prompt.user, maxTokens: prompt.maxTokens, signal: AbortSignal.timeout(60_000) });
  for await (const chunk of generation.chunks) {
    firstTokenMs ??= Date.now() - started;
    raw += chunk;
    events.push(...parser.push(chunk));
  }
  events.push(...parser.end());
  const usage = generation.usage();
  const price = resolvePrice(model, {});
  return {
    label,
    events,
    raw,
    firstTokenMs,
    totalMs: Date.now() - started,
    promptTokens: usage?.promptTokens ?? 0,
    completionTokens: usage?.completionTokens ?? 0,
    costMicroUsd: costMicroUsd(price, usage?.promptTokens ?? 0, usage?.completionTokens ?? 0),
    reportedCostUsd: usage?.reportedCostUsd ?? null,
    systemChars: prompt.system.length,
  };
}

interface Turn {
  id: string;
  role: 'seat' | 'synthesis';
  seatId?: SeatId;
  replyToSeatId?: SeatId;
  text: string;
}

function turnsOf(events: CouncilEvent[]): Turn[] {
  const turns: Turn[] = [];
  for (const event of events) {
    if (event.type === 'turn_start') turns.push({ id: event.turnId, role: event.role, seatId: event.seatId, replyToSeatId: event.replyToSeatId, text: '' });
    if (event.type === 'delta') turns.find((t) => t.id === event.turnId)!.text += event.text;
  }
  return turns;
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

function render(model: string, evalCase: EvalCase, exchanges: Exchange[]): string {
  const lines = [`# ${evalCase.id} · ${model}`, `Q: ${evalCase.question}`, ''];
  for (const ex of exchanges) {
    lines.push(
      `## ${ex.label}  (first token ${ex.firstTokenMs}ms, total ${ex.totalMs}ms, ${ex.promptTokens} in / ${ex.completionTokens} out, ` +
        `${ex.costMicroUsd} micro-USD computed, ${ex.reportedCostUsd ?? 'n/a'} USD reported, system ${ex.systemChars} chars)`,
    );
    for (const event of ex.events) {
      if (event.type === 'routing') lines.push(`ROUTING ${event.seatIds.join(', ')} | ${event.reason}`);
      if (event.type === 'follow_up') lines.push(`ASK ${event.question}`);
    }
    for (const turn of turnsOf(ex.events)) {
      lines.push('', `[${turn.role}${turn.seatId ? ` ${turn.seatId}` : ''}${turn.replyToSeatId ? ` -> ${turn.replyToSeatId}` : ''}] (${words(turn.text)} words)`, turn.text);
    }
    lines.push('', '--- raw model output ---', ex.raw, '--- end raw ---', '');
  }
  lines.push('Look for:', ...evalCase.lookFor.map((l) => `- ${l}`), '');
  return lines.join('\n');
}

async function runCase(model: string, evalCase: EvalCase): Promise<Exchange[]> {
  const id = () => crypto.randomUUID();
  const opening = await exchange(model, `${evalCase.id}:open`, {
    requestId: id(),
    action: 'open',
    question: evalCase.question,
    seatIds: evalCase.seatIds,
    transcript: [],
  });
  if (!evalCase.followUp) return [opening];

  const transcript: TranscriptTurn[] = turnsOf(opening.events).map((t) => ({ id: t.id, role: t.role, seatId: t.seatId, action: 'open', text: t.text }));
  const follow = evalCase.followUp;
  const followUp = await exchange(model, `${evalCase.id}:${follow.action}`, {
    requestId: id(),
    action: follow.action,
    question: evalCase.question,
    text: follow.text,
    seatIds: follow.seatIds ?? (follow.seatId ? [follow.seatId] : undefined),
    transcript,
    threadToken: 'eval',
  });
  return [opening, followUp];
}

test.skipIf(caseIds.length === 0)('council eval', async () => {
  mkdirSync(outDir, { recursive: true });
  const cases = caseIds.map((caseId) => {
    const found = EVAL_CASES.find((c) => c.id === caseId);
    if (!found) throw new Error(`unknown eval case ${caseId}`);
    return found;
  });
  for (const model of models) {
    for (const evalCase of cases) {
      const exchanges = await runCase(model, evalCase);
      const file = join(outDir, `${evalCase.id}__${model.replace(/[^a-z0-9.-]+/gi, '_')}.txt`);
      writeFileSync(file, render(model, evalCase, exchanges));
      for (const ex of exchanges) expect(turnsOf(ex.events).length, `${ex.label} produced no usable turns`).toBeGreaterThan(0);
    }
  }
  expect(existsSync(join(outDir, 'calls.log'))).toBe(true);
});
