// Server-only configuration for The Council. Everything here is read from
// process.env at request time; nothing is exposed to client bundles.
//
//   OPENROUTER_API_KEY            required for live replies (secret)
//   COUNCIL_SECRET                required, 32+ chars; keys visitor hashes,
//                                 the visitor cookie and thread tokens (secret)
//   DATABASE_URL                  required; the quota table lives there
//   COUNCIL_LIVE=off              kill switch
//   COUNCIL_MODEL                 default DEFAULT_MODEL below
//   COUNCIL_DAILY_GENERATIONS     site-wide ceiling per UTC day, default 150
//   COUNCIL_DAILY_BUDGET_USD      site-wide ceiling per UTC day, default 1.00
//   COUNCIL_PRICE_INPUT_PER_MTOK  / COUNCIL_PRICE_OUTPUT_PER_MTOK
//                                 override the price table for COUNCIL_MODEL
//   COUNCIL_REASONING_EFFORT      default "none"
//   COUNCIL_DEV_UNLIMITED=1       local dev only: skip the visitor cap
//
// Without the key, the secret or the database the feature reports itself as
// off and never calls the model.

export interface ModelPrice {
  /** USD per million prompt tokens. */
  inputPerMTok: number;
  /** USD per million completion tokens. */
  outputPerMTok: number;
}

// Chosen by bake-off on 2026-11-16 (see scripts/council-eval.live.ts).
export const DEFAULT_MODEL = 'openai/gpt-6-luna';

// Prices seen on https://openrouter.ai/api/v1/models on 2026-11-16, in USD
// per million tokens. The daily dollar ceiling is computed from these, so
// update them when the model changes (or set COUNCIL_PRICE_INPUT_PER_MTOK /
// COUNCIL_PRICE_OUTPUT_PER_MTOK).
//
// Input is the worst case we are actually billed, not the headline rate:
//   openai/gpt-6-luna            listed 0.10 in / 0.50 out. A prompt over
//                                1,024 tokens is written to the prompt cache
//                                at 0.125 (and read back at 0.01), so an
//                                uncached request really costs 0.125 in.
//   anthropic/claude-haiku-5.5   listed 0.10 in / 0.50 out, cache write 0.125.
//                                Its tokenizer counts about 47% more tokens
//                                for the same prompt.
//   deepseek/deepseek-v4.1-flash listed 0.14 in / 0.42 out. Billed up to 1.4x
//                                that in testing, depending on which host
//                                OpenRouter routed to, hence the margin.
export const MODEL_PRICES: Record<string, ModelPrice> = {
  'openai/gpt-6-luna': { inputPerMTok: 0.125, outputPerMTok: 0.5 },
  'anthropic/claude-haiku-5.5': { inputPerMTok: 0.125, outputPerMTok: 0.5 },
  'deepseek/deepseek-v4.1-flash': { inputPerMTok: 0.2, outputPerMTok: 0.6 },
};

// A model with no known price is assumed to be expensive, so a typo in
// COUNCIL_MODEL exhausts the budget early instead of silently overspending.
const UNKNOWN_MODEL_PRICE: ModelPrice = { inputPerMTok: 3, outputPerMTok: 15 };

export const DEFAULT_DAILY_GENERATIONS = 150;
export const DEFAULT_DAILY_BUDGET_USD = 1.0;

/** No first token from the provider within this window: give up. */
export const FIRST_TOKEN_TIMEOUT_MS = 8_000;
/** Whole upstream exchange, repair attempt included. Client gives up at 20s. */
export const TOTAL_TIMEOUT_MS = 16_000;

export type Env = Record<string, string | undefined>;

export interface CouncilConfig {
  /** False when the kill switch is on or anything needed to run safely is missing. */
  live: boolean;
  apiKey: string | null;
  secret: string | null;
  databaseUrl: string | null;
  model: string;
  price: ModelPrice;
  /** Sent as reasoning.effort. "none" keeps cheap models fast and on budget. */
  reasoningEffort: string | null;
  dailyGenerations: number;
  dailyBudgetMicroUsd: number;
  devUnlimited: boolean;
  secureCookies: boolean;
  siteUrl: string;
}

function positiveNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Next inlines this literal at build time, so a production build can never
// see anything but "production" here, whatever the runtime environment says.
const BUILD_NODE_ENV = process.env.NODE_ENV;

/**
 * The dev-only escape hatch for the visitor cap. Requires an explicit flag
 * AND a non-production build AND a non-production runtime AND not being a
 * Vercel production deployment. Any one of those failing turns it off.
 */
export function isDevUnlimited(env: Env, buildNodeEnv: string | undefined = BUILD_NODE_ENV): boolean {
  if (env.COUNCIL_DEV_UNLIMITED !== '1') return false;
  if (buildNodeEnv === 'production') return false;
  if (env.NODE_ENV === 'production') return false;
  if (env.VERCEL_ENV === 'production') return false;
  return true;
}

export function resolvePrice(model: string, env: Env): ModelPrice {
  const base = MODEL_PRICES[model] ?? UNKNOWN_MODEL_PRICE;
  return {
    inputPerMTok: positiveNumber(env.COUNCIL_PRICE_INPUT_PER_MTOK, base.inputPerMTok),
    outputPerMTok: positiveNumber(env.COUNCIL_PRICE_OUTPUT_PER_MTOK, base.outputPerMTok),
  };
}

export function readConfig(env: Env = process.env, buildNodeEnv: string | undefined = BUILD_NODE_ENV): CouncilConfig {
  const apiKey = env.OPENROUTER_API_KEY?.trim() || null;
  const rawSecret = env.COUNCIL_SECRET?.trim() || '';
  // A short secret would make visitor hashes and thread tokens guessable.
  const secret = rawSecret.length >= 32 ? rawSecret : null;
  const databaseUrl = env.DATABASE_URL?.trim() || null;
  const model = env.COUNCIL_MODEL?.trim() || DEFAULT_MODEL;
  const switchedOff = (env.COUNCIL_LIVE ?? '').trim().toLowerCase() === 'off';
  const effort = (env.COUNCIL_REASONING_EFFORT ?? 'none').trim().toLowerCase();

  return {
    live: !switchedOff && apiKey !== null && secret !== null && databaseUrl !== null,
    apiKey,
    secret,
    databaseUrl,
    model,
    price: resolvePrice(model, env),
    reasoningEffort: effort === '' || effort === 'default' ? null : effort,
    dailyGenerations: Math.floor(positiveNumber(env.COUNCIL_DAILY_GENERATIONS, DEFAULT_DAILY_GENERATIONS)),
    dailyBudgetMicroUsd: Math.round(positiveNumber(env.COUNCIL_DAILY_BUDGET_USD, DEFAULT_DAILY_BUDGET_USD) * 1_000_000),
    devUnlimited: isDevUnlimited(env, buildNodeEnv),
    secureCookies: env.NODE_ENV === 'production',
    siteUrl: env.COUNCIL_SITE_URL?.trim() || 'https://rohanpradyumna.vercel.app',
  };
}

/** Price per million tokens times tokens is micro-dollars. Rounded up. */
export function costMicroUsd(price: ModelPrice, promptTokens: number, completionTokens: number): number {
  return Math.ceil(Math.max(0, promptTokens) * price.inputPerMTok + Math.max(0, completionTokens) * price.outputPerMTok);
}

// Characters per token are only a fair guess for Latin text. One CJK
// character, or half an emoji (a surrogate), is roughly a token by itself, so
// counting characters alone would undercount such text several times over.
const NON_LATIN_TOKENS_PER_CHAR = 1.5;
const ACCENTED_TOKENS_PER_CHAR = 0.5;

/** Unrounded token weight, so many small pieces can be summed before rounding up once. */
export function tokenWeight(text: string, asciiCharsPerToken = 3.5): number {
  let ascii = 0;
  let accented = 0;
  let other = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Typographic punctuation (curly quotes, ellipsis) tokenizes like ASCII.
    if (code < 0x80 || (code >= 0x2000 && code <= 0x206f)) ascii += 1;
    else if (code < 0x370) accented += 1;
    else other += 1;
  }
  return ascii / asciiCharsPerToken + accented * ACCENTED_TOKENS_PER_CHAR + other * NON_LATIN_TOKENS_PER_CHAR;
}

/** Token estimate with ASCII at `asciiCharsPerToken` and other scripts weighted up. */
export function weightedTokens(text: string, asciiCharsPerToken: number): number {
  return Math.ceil(tokenWeight(text, asciiCharsPerToken));
}

/** Deliberately pessimistic: used for money (reservations, cut-off streams). */
export function estimateTokens(text: string): number {
  return weightedTokens(text, 3.5);
}

/** No prompt is ever larger than this, in estimateTokens units (see prompt.ts). */
export const MAX_PROMPT_TOKENS_ESTIMATE = 9_800;
/** No request asks the model for more than this many tokens. */
export const MAX_OUTPUT_TOKENS = 1_600;

/**
 * The most one request can cost: the largest prompt and the largest output,
 * twice over for the one repair attempt. Every in-flight request holds this
 * much of the daily budget, and GET uses the same figure to say whether one
 * more request would fit.
 */
export function worstCaseHoldMicroUsd(price: ModelPrice): number {
  return 2 * costMicroUsd(price, MAX_PROMPT_TOKENS_ESTIMATE, MAX_OUTPUT_TOKENS);
}
