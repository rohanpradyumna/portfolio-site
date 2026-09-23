import { NextRequest } from 'next/server';

// Low threat model (a personal admin approval queue, not a multi-tenant
// system), so a plain string comparison against a shared secret is enough.
export function isAuthorizedAdmin(req: NextRequest): boolean {
  const token = process.env.WHEEL_ADMIN_TOKEN;
  if (!token) return false;

  const header = req.headers.get('authorization');
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const provided = bearer ?? req.nextUrl.searchParams.get('token');

  return provided === token;
}
