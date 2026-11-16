import { describe, expect, it } from 'vitest';
import { MAX_OUTPUT_TOKENS, MAX_PROMPT_TOKENS_ESTIMATE, costMicroUsd, isDevUnlimited, readConfig, resolvePrice, worstCaseHoldMicroUsd } from './config';
import {
  THREAD_TTL_MS,
  VISITOR_COOKIE_MAX_AGE_S,
  starterThreadId,
  clientIp,
  hashIp,
  hashVisitorId,
  mintVisitorId,
  normalizeIp,
  readVisitorCookie,
  serializeVisitorCookie,
  signThreadToken,
  verifyThreadToken,
  visitorCookieValue,
} from './identity';

const SECRET = 'a'.repeat(64);
const OTHER_SECRET = 'b'.repeat(64);
const NOW = Date.UTC(2026, 10, 16, 12);

describe('ip handling', () => {
  it('reads the first x-forwarded-for entry, then x-real-ip, else a shared unknown bucket', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1', 'x-real-ip': '198.51.100.1' }))).toBe('203.0.113.7');
    expect(clientIp(new Headers({ 'x-real-ip': '198.51.100.1' }))).toBe('198.51.100.1');
    expect(clientIp(new Headers())).toBe('unknown');
    expect(clientIp(new Headers({ 'x-forwarded-for': 'not an ip' }))).toBe('unknown');
  });

  it('normalizes ports, brackets and IPv4-mapped addresses to one form', () => {
    expect(normalizeIp('203.0.113.7:51234')).toBe('203.0.113.7');
    expect(normalizeIp('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(normalizeIp(' 203.0.113.7 ')).toBe('203.0.113.7');
    expect(normalizeIp('[2001:db8::1]:443')).toBe(normalizeIp('2001:db8::1'));
  });

  it('treats every address in an IPv6 /64 as the same visitor, and different /64s as different', () => {
    const a = normalizeIp('2001:db8:abcd:12:1111:2222:3333:4444');
    const b = normalizeIp('2001:0DB8:ABCD:0012:ffff:eeee:dddd:cccc');
    const c = normalizeIp('2001:db8:abcd:13::1');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(normalizeIp('::1')).toBe('0:0:0:0::/64');
  });

  it('never stores the address: the hash is keyed and does not contain the IP', () => {
    const hash = hashIp(SECRET, '203.0.113.7');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('203');
    expect(hashIp(SECRET, '203.0.113.7')).toBe(hash);
    expect(hashIp(SECRET, '203.0.113.8')).not.toBe(hash);
    expect(hashIp(OTHER_SECRET, '203.0.113.7')).not.toBe(hash);
  });
});

describe('visitor cookie', () => {
  it('round-trips a server-minted id', () => {
    const id = mintVisitorId();
    const header = `theme=dark; council_vid=${visitorCookieValue(SECRET, id)}; other=1`;
    expect(readVisitorCookie(SECRET, header)).toBe(id);
  });

  it('rejects a forged, tampered or foreign-secret cookie', () => {
    const id = mintVisitorId();
    const value = visitorCookieValue(SECRET, id);
    expect(readVisitorCookie(SECRET, `council_vid=${id}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`)).toBeNull();
    expect(readVisitorCookie(SECRET, `council_vid=${mintVisitorId()}.${value.split('.')[1]}`)).toBeNull();
    expect(readVisitorCookie(OTHER_SECRET, `council_vid=${value}`)).toBeNull();
    expect(readVisitorCookie(SECRET, `council_vid=${id}`)).toBeNull();
    expect(readVisitorCookie(SECRET, 'council_vid=')).toBeNull();
    expect(readVisitorCookie(SECRET, null)).toBeNull();
  });

  it('is httpOnly, scoped to the API path, and Secure in production', () => {
    const dev = serializeVisitorCookie('v', false);
    const prod = serializeVisitorCookie('v', true);
    expect(dev).toMatch(/HttpOnly/);
    expect(dev).toMatch(/SameSite=Lax/);
    expect(dev).toMatch(/Path=\/api\/council/);
    expect(dev).not.toMatch(/Secure/);
    expect(prod).toMatch(/; Secure/);
  });

  it('lasts 30 days', () => {
    expect(VISITOR_COOKIE_MAX_AGE_S).toBe(30 * 24 * 60 * 60);
    expect(serializeVisitorCookie('v', true)).toContain('Max-Age=2592000;');
  });

  it('hashes the id before it is stored', () => {
    const id = mintVisitorId();
    expect(hashVisitorId(SECRET, id)).not.toContain(id);
    expect(hashVisitorId(SECRET, id)).not.toBe(hashIp(SECRET, id));
  });
});

describe('thread tokens', () => {
  const who = { ipHash: hashIp(SECRET, '203.0.113.7'), cookieHash: hashVisitorId(SECRET, 'visitor-one-id-0000') };
  const issue = (over: Partial<Parameters<typeof signThreadToken>[1]> = {}) =>
    signThreadToken(SECRET, { threadId: 'thread-1', ...who, base: 0, expiresAt: NOW + THREAD_TTL_MS, ...over });

  it('verifies a token it issued and returns the thread id and base', () => {
    const verdict = verifyThreadToken(SECRET, issue({ base: 1 }), who, NOW);
    expect(verdict).toMatchObject({ ok: true, claims: { t: 'thread-1', b: 1 } });
  });

  it('rejects a token whose payload was edited (more exchanges, new thread id, later expiry)', () => {
    const [version, body, signature] = issue({ base: 1 }).split('.');
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString());
    for (const edit of [{ b: 0 }, { t: 'someone-elses-thread' }, { e: NOW + 10 * THREAD_TTL_MS }]) {
      const forgedBody = Buffer.from(JSON.stringify({ ...claims, ...edit })).toString('base64url');
      expect(verifyThreadToken(SECRET, `${version}.${forgedBody}.${signature}`, who, NOW)).toEqual({ ok: false, reason: 'bad_signature' });
    }
  });

  it('rejects tokens signed with another secret, and garbage', () => {
    const foreign = signThreadToken(OTHER_SECRET, { threadId: 'thread-1', ...who, base: 0, expiresAt: NOW + THREAD_TTL_MS });
    expect(verifyThreadToken(SECRET, foreign, who, NOW)).toEqual({ ok: false, reason: 'bad_signature' });
    for (const junk of ['', 'v1', 'v1..', 'a.b.c', 'v2.x.y', 42, null, undefined, 'x'.repeat(5000)]) {
      expect(verifyThreadToken(SECRET, junk, who, NOW).ok).toBe(false);
    }
  });

  it('expires', () => {
    const token = issue({ expiresAt: NOW + 1000 });
    expect(verifyThreadToken(SECRET, token, who, NOW + 999).ok).toBe(true);
    expect(verifyThreadToken(SECRET, token, who, NOW + 1000)).toEqual({ ok: false, reason: 'expired' });
  });

  it('derives a stable starter thread id per visitor and starter, without exposing either', () => {
    const one = starterThreadId(SECRET, 'admire-without-respect', who.ipHash);
    expect(starterThreadId(SECRET, 'admire-without-respect', who.ipHash)).toBe(one);
    expect(starterThreadId(SECRET, 'meaning-is-made', who.ipHash)).not.toBe(one);
    expect(starterThreadId(SECRET, 'admire-without-respect', hashIp(SECRET, '198.51.100.9'))).not.toBe(one);
    expect(starterThreadId(OTHER_SECRET, 'admire-without-respect', who.ipHash)).not.toBe(one);
    expect(one).not.toContain(who.ipHash.slice(0, 8));
    expect(one).not.toContain('admire');
  });

  it('is bound to the visitor: either identifier keeps it, neither loses it', () => {
    const token = issue();
    const newNetwork = { ...who, ipHash: hashIp(SECRET, '198.51.100.9') };
    const clearedCookies = { ...who, cookieHash: hashVisitorId(SECRET, 'a-brand-new-cookie-id') };
    const stranger = { ipHash: newNetwork.ipHash, cookieHash: clearedCookies.cookieHash };
    expect(verifyThreadToken(SECRET, token, newNetwork, NOW).ok).toBe(true);
    expect(verifyThreadToken(SECRET, token, clearedCookies, NOW).ok).toBe(true);
    expect(verifyThreadToken(SECRET, token, stranger, NOW)).toEqual({ ok: false, reason: 'wrong_visitor' });
  });
});

describe('config', () => {
  const full = { OPENROUTER_API_KEY: 'sk-test', COUNCIL_SECRET: SECRET, DATABASE_URL: 'postgres://x' };

  it('is live only with a key, a strong secret and a database, and never when switched off', () => {
    expect(readConfig(full).live).toBe(true);
    expect(readConfig({ ...full, OPENROUTER_API_KEY: undefined }).live).toBe(false);
    expect(readConfig({ ...full, OPENROUTER_API_KEY: '  ' }).live).toBe(false);
    expect(readConfig({ ...full, COUNCIL_SECRET: undefined }).live).toBe(false);
    expect(readConfig({ ...full, COUNCIL_SECRET: 'too-short' }).live).toBe(false);
    expect(readConfig({ ...full, DATABASE_URL: undefined }).live).toBe(false);
    expect(readConfig({ ...full, COUNCIL_LIVE: 'off' }).live).toBe(false);
    expect(readConfig({ ...full, COUNCIL_LIVE: 'OFF' }).live).toBe(false);
    expect(readConfig({}).live).toBe(false);
  });

  it('falls back to safe ceilings when the env values are missing or nonsense', () => {
    for (const bad of [undefined, '', 'lots', '-5', 'NaN']) {
      const config = readConfig({ ...full, COUNCIL_DAILY_GENERATIONS: bad, COUNCIL_DAILY_BUDGET_USD: bad });
      expect(config.dailyGenerations).toBe(150);
      expect(config.dailyBudgetMicroUsd).toBe(1_000_000);
    }
    const tuned = readConfig({ ...full, COUNCIL_DAILY_GENERATIONS: '40', COUNCIL_DAILY_BUDGET_USD: '0.25' });
    expect(tuned.dailyGenerations).toBe(40);
    expect(tuned.dailyBudgetMicroUsd).toBe(250_000);
  });

  it('prices an unknown model high, so a typo cannot overspend quietly', () => {
    const known = resolvePrice('openai/gpt-6-luna', {});
    const unknown = resolvePrice('someone/typo-model', {});
    expect(unknown.inputPerMTok).toBeGreaterThan(known.inputPerMTok * 10);
    expect(unknown.outputPerMTok).toBeGreaterThan(known.outputPerMTok * 10);
    expect(resolvePrice('someone/typo-model', { COUNCIL_PRICE_INPUT_PER_MTOK: '0.2', COUNCIL_PRICE_OUTPUT_PER_MTOK: '0.8' })).toEqual({
      inputPerMTok: 0.2,
      outputPerMTok: 0.8,
    });
  });

  it('holds the worst case of one request: the largest prompt and output, twice for the repair', () => {
    const price = { inputPerMTok: 0.125, outputPerMTok: 0.5 };
    expect(worstCaseHoldMicroUsd(price)).toBe(2 * costMicroUsd(price, MAX_PROMPT_TOKENS_ESTIMATE, MAX_OUTPUT_TOKENS));
    // Small next to the default daily budget, so it costs almost no headroom.
    expect(worstCaseHoldMicroUsd(price)).toBeLessThan(0.01 * 1_000_000);
  });

  it('computes cost in micro-dollars from tokens and per-million prices, rounding up', () => {
    expect(costMicroUsd({ inputPerMTok: 0.125, outputPerMTok: 0.5 }, 4000, 600)).toBe(800);
    expect(costMicroUsd({ inputPerMTok: 0.125, outputPerMTok: 0.5 }, 1, 0)).toBe(1);
    expect(costMicroUsd({ inputPerMTok: 0.125, outputPerMTok: 0.5 }, -5, -5)).toBe(0);
  });
});

describe('the dev-unlimited flag', () => {
  it('works in local development when explicitly set', () => {
    expect(isDevUnlimited({ COUNCIL_DEV_UNLIMITED: '1', NODE_ENV: 'development' }, 'development')).toBe(true);
  });

  it('needs the exact value 1', () => {
    for (const value of [undefined, '', '0', 'true', 'yes', ' 1']) {
      expect(isDevUnlimited({ COUNCIL_DEV_UNLIMITED: value, NODE_ENV: 'development' }, 'development')).toBe(false);
    }
  });

  it('is inert in production however it is set', () => {
    // A production build (Next inlines NODE_ENV at build time).
    expect(isDevUnlimited({ COUNCIL_DEV_UNLIMITED: '1', NODE_ENV: 'development' }, 'production')).toBe(false);
    // A production runtime.
    expect(isDevUnlimited({ COUNCIL_DEV_UNLIMITED: '1', NODE_ENV: 'production' }, 'development')).toBe(false);
    // Vercel production, even if NODE_ENV were somehow wrong.
    expect(isDevUnlimited({ COUNCIL_DEV_UNLIMITED: '1', NODE_ENV: 'development', VERCEL_ENV: 'production' }, 'development')).toBe(false);
    // What a real Vercel production deployment looks like.
    const vercel = { COUNCIL_DEV_UNLIMITED: '1', NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'production' };
    expect(isDevUnlimited(vercel, 'production')).toBe(false);
    expect(readConfig({ ...vercel, OPENROUTER_API_KEY: 'k', COUNCIL_SECRET: SECRET, DATABASE_URL: 'postgres://x' }, 'production').devUnlimited).toBe(false);
  });
});
