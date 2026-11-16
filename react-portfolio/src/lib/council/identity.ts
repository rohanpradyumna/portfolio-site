import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Visitor identity and thread tokens. Nothing here stores or returns a raw IP:
// the only things that leave this module are keyed hashes and signed tokens.

export const VISITOR_COOKIE = 'council_vid';
// The cap it supports looks back 24 hours, so a month is already generous.
export const VISITOR_COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60;
export const THREAD_TTL_MS = 24 * 60 * 60 * 1000;

function hmac(secret: string, data: string): Buffer {
  return createHmac('sha256', secret).update(data).digest();
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// ---------------------------------------------------------------------------
// IP
// ---------------------------------------------------------------------------

function expandIpv6(ip: string): string[] | null {
  const [head, tail, extra] = ip.split('::');
  if (extra !== undefined) return null;
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  if (tail === undefined) return headParts.length === 8 ? headParts : null;
  const missing = 8 - headParts.length - tailParts.length;
  if (missing < 0) return null;
  return [...headParts, ...Array(missing).fill('0'), ...tailParts];
}

/**
 * Canonical form used for hashing. IPv6 is cut to its /64: one household or
 * device normally controls the whole /64 and can rotate through it freely,
 * so hashing the full address would hand out a fresh quota per rotation.
 */
export function normalizeIp(raw: string): string {
  let ip = raw.trim().toLowerCase();
  if (!ip) return 'unknown';
  if (ip.startsWith('[')) ip = ip.slice(1, ip.indexOf(']') === -1 ? undefined : ip.indexOf(']'));
  const zone = ip.indexOf('%');
  if (zone !== -1) ip = ip.slice(0, zone);
  const mapped = /^(?:::ffff:|::)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  if (mapped) return mapped[1];
  const v4 = /^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/.exec(ip);
  if (v4) return v4[1];
  if (ip.includes(':')) {
    const parts = expandIpv6(ip);
    if (!parts || parts.some((p) => !/^[0-9a-f]{0,4}$/.test(p))) return 'unknown';
    return parts.slice(0, 4).map((p) => p.replace(/^0+(?=.)/, '') || '0').join(':') + '::/64';
  }
  return 'unknown';
}

/**
 * Which header we trust, and why: on Vercel the platform OVERWRITES
 * x-forwarded-for with the connecting client's public IP and does not pass
 * through a client-supplied value, so it cannot be spoofed there. x-real-ip
 * carries the same value and is the fallback. Off Vercel (plain `next start`
 * with no trusted proxy) these headers are attacker-controlled; the feature
 * is only meant to run behind Vercel. An unreadable IP collapses to one
 * shared "unknown" bucket, which fails closed instead of open.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0];
  return normalizeIp(forwarded || headers.get('x-real-ip') || '');
}

export function hashIp(secret: string, ip: string): string {
  return hmac(secret, `ip:${ip}`).toString('hex');
}

// ---------------------------------------------------------------------------
// Visitor cookie: a random id signed by the server. It is a second handle on
// the same visitor so that changing networks does not reset the daily cap.
// ---------------------------------------------------------------------------

function signVisitorId(secret: string, id: string): string {
  return hmac(secret, `vid-sig:${id}`).toString('base64url').slice(0, 32);
}

export function mintVisitorId(): string {
  return randomBytes(16).toString('base64url');
}

export function visitorCookieValue(secret: string, id: string): string {
  return `${id}.${signVisitorId(secret, id)}`;
}

/** Returns the visitor id, or null when the cookie is absent or not ours. */
export function readVisitorCookie(secret: string, cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1 || part.slice(0, eq).trim() !== VISITOR_COOKIE) continue;
    const [id, sig, ...rest] = part.slice(eq + 1).trim().split('.');
    if (!id || !sig || rest.length > 0 || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) return null;
    return safeEqual(sig, signVisitorId(secret, id)) ? id : null;
  }
  return null;
}

export function serializeVisitorCookie(value: string, secure: boolean): string {
  const attrs = [`${VISITOR_COOKIE}=${value}`, 'Path=/api/council', `Max-Age=${VISITOR_COOKIE_MAX_AGE_S}`, 'HttpOnly', 'SameSite=Lax'];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

export function hashVisitorId(secret: string, id: string): string {
  return hmac(secret, `vid:${id}`).toString('hex');
}

// ---------------------------------------------------------------------------
// Thread tokens
// ---------------------------------------------------------------------------

export interface ThreadClaims {
  /** Thread id. */
  t: string;
  /** Visitor binding: prefixes of the IP hash and cookie hash at issue time. */
  i: string;
  c: string;
  /** Exchanges already counted before any live generation (1 for a starter thread). */
  b: number;
  /** Expiry, epoch milliseconds. Fixed at thread creation, never extended. */
  e: number;
}

const BIND_LEN = 16;

export function newThreadId(): string {
  return randomBytes(12).toString('base64url');
}

/**
 * A starter thread has no opening on the server to hang a token on, so its
 * id is derived instead of random: the same visitor following up the same
 * starter lands on the same thread, and the thread cap applies to it.
 */
export function starterThreadId(secret: string, starterId: string, visitorKey: string): string {
  return `s_${hmac(secret, `starter-thread:${starterId}:${visitorKey}`).toString('base64url').slice(0, 20)}`;
}

export function signThreadToken(
  secret: string,
  input: { threadId: string; ipHash: string; cookieHash: string; base: number; expiresAt: number },
): string {
  const claims: ThreadClaims = {
    t: input.threadId,
    i: input.ipHash.slice(0, BIND_LEN),
    c: input.cookieHash.slice(0, BIND_LEN),
    b: input.base,
    e: input.expiresAt,
  };
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `v1.${body}.${hmac(secret, `thread:v1.${body}`).toString('base64url')}`;
}

export type ThreadVerdict =
  | { ok: true; claims: ThreadClaims }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' | 'wrong_visitor' };

/**
 * A token is honored when the signature is ours, it has not expired, and the
 * caller matches EITHER identifier it was issued to (so a visitor who changes
 * network mid-thread keeps the thread through the cookie, and one who blocks
 * cookies keeps it through the IP).
 */
export function verifyThreadToken(
  secret: string,
  token: unknown,
  who: { ipHash: string; cookieHash: string },
  now: number,
): ThreadVerdict {
  if (typeof token !== 'string' || token.length > 600) return { ok: false, reason: 'malformed' };
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return { ok: false, reason: 'malformed' };
  const expected = hmac(secret, `thread:v1.${parts[1]}`).toString('base64url');
  if (!safeEqual(parts[2], expected)) return { ok: false, reason: 'bad_signature' };
  let claims: ThreadClaims;
  try {
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (
    typeof claims?.t !== 'string' ||
    typeof claims.i !== 'string' ||
    typeof claims.c !== 'string' ||
    typeof claims.b !== 'number' ||
    typeof claims.e !== 'number'
  ) {
    return { ok: false, reason: 'malformed' };
  }
  if (now >= claims.e) return { ok: false, reason: 'expired' };
  const sameIp = safeEqual(claims.i, who.ipHash.slice(0, BIND_LEN));
  const sameCookie = safeEqual(claims.c, who.cookieHash.slice(0, BIND_LEN));
  if (!sameIp && !sameCookie) return { ok: false, reason: 'wrong_visitor' };
  return { ok: true, claims };
}
