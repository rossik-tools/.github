// Cloudflare Access JWT verification for a rossik-tools Supabase edge function.
//
// CANONICAL COPY: rossik-tools/.github shared/access/edge/access-auth.ts. Every module keeps a
// verbatim copy at supabase/functions/_shared/access-auth.ts. Change it here, then copy it into
// every module in the same round, and redeploy the functions that import it. Never edit a
// module's copy. Module-specific code (audience from env or config, audit, rate limits) lives
// in a separate file next to it.
//
// WHY THIS IS STRICT: these functions live on *.functions.supabase.co, which is NOT behind
// the Cloudflare Access perimeter. Anyone on the internet can send an arbitrary header named
// CF-Access-JWT-Assertion straight at them. The presence of the header proves NOTHING.
// The boundary is: RS256 signature verified against the team JWKS + exact issuer + exact
// audience + expiry, and only then a database lookup of the VERIFIED e-mail.
//
// Fail-closed everywhere: any doubt (missing key, fetch error, unexpected shape) -> deny.
//
// Same rules as shared/access/access.server.ts (the Worker/Pages side). Separate file because
// the runtime differs (Deno, URL imports) and an edge function also needs the database client.

import { createRemoteJWKSet, jwtVerify, decodeProtectedHeader } from 'https://deno.land/x/jose@v5.9.6/index.ts';
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export const admin = (): SupabaseClient =>
  createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

export const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  });

// TRUST ROOT - hardcoded on purpose (security review 2026-08-21).
// The issuer and the JWKS URL must NEVER come from configuration: whoever can write that
// configuration could otherwise point verification at their own key server, sign a token
// claiming any identity, and act as anyone. Config may only NARROW policy (which
// audiences), never move the trust anchor.
const CF_TEAM = 'rossiktools.cloudflareaccess.com';
const CF_ISSUER = 'https://' + CF_TEAM;
const CF_CERTS_URL = CF_ISSUER + '/cdn-cgi/access/certs';
const CLOCK_SKEW_S = 60;
// Absolute ceiling on token age. Access sessions are 168h; a token older than that is
// refused here regardless of what the Access policy says.
const MAX_TOKEN_AGE_S = 7 * 24 * 3600;

const AUD_RE = /^[0-9a-f]{64}$/;

// Single JWKS instance against the hardcoded certificate URL. jose caches keys and refetches
// on an unknown kid. Nothing external can influence which key server is used.
const JWKS = createRemoteJWKSet(new URL(CF_CERTS_URL));

export type Identity = { email: string; sub?: string; aud: string };
export type AuthFailure = { error: Response };

function fail(reason: string, status = 401): AuthFailure {
  // Deliberately terse to the caller; the detail belongs in the log, not in the response.
  return { error: json({ error: status === 403 ? 'forbidden' : 'unauthorized', reason }, status) };
}

/** Extract the Access token from header or cookie. Header wins. */
function extractToken(req: Request): string | null {
  const h = req.headers.get('CF-Access-JWT-Assertion');
  if (h && h.length > 20) return h.trim();
  const cookie = req.headers.get('Cookie') ?? '';
  const m = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  if (!m) return null;
  // decodeURIComponent throws URIError on a malformed escape ("%"), and this runs before
  // anything is verified. Unguarded it turned an anonymous request into a 500 with a
  // stack trace in the function log, which contradicts this file's own rule that any
  // doubt means deny. A cookie we cannot decode is simply not a token.
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

/**
 * Verify a Cloudflare Access JWT and return the verified identity. `audiences` pins the
 * Access application(s) whose tokens may authorize the caller.
 */
export async function verifyAccessJwt(req: Request, audiences: string[]): Promise<Identity | AuthFailure> {
  const auds = audiences.filter((a) => AUD_RE.test(a));
  if (auds.length === 0) return fail('no_audience_configured', 403);

  const token = extractToken(req);
  if (!token) return fail('missing_token');

  // Reject unsigned and symmetric algorithms before touching the JWKS.
  let alg: string | undefined;
  try { alg = decodeProtectedHeader(token).alg; } catch { return fail('malformed_token'); }
  if (alg !== 'RS256') return fail('bad_alg');

  let payload: Record<string, unknown>;
  try {
    const res = await jwtVerify(token, JWKS, {
      issuer: CF_ISSUER,
      audience: auds,
      clockTolerance: CLOCK_SKEW_S,
      algorithms: ['RS256'],
    });
    payload = res.payload as Record<string, unknown>;
  } catch {
    // Covers bad signature, unknown kid, JWKS fetch failure, wrong issuer or audience,
    // and expiry. All of them deny; there is no allow-on-error path.
    return fail('verification_failed');
  }

  const iat = payload.iat;
  if (typeof iat !== 'number' || (Date.now() / 1000) - iat > MAX_TOKEN_AGE_S) {
    return fail('token_too_old');
  }

  // Service tokens carry common_name and no e-mail. This endpoint serves humans only.
  if (payload.common_name && !payload.email) return fail('service_token_not_allowed', 403);

  const rawEmail = typeof payload.email === 'string' ? payload.email.trim() : '';
  // ASCII only: blocks IDN and unicode homoglyphs that look identical to a colleague's
  // address. Same bypass class that was found and fixed in the platform's cf-dns function.
  if (!/^[\x21-\x7E]+$/.test(rawEmail)) return fail('non_ascii_email');
  const email = rawEmail.toLowerCase();
  if (!email.includes('@')) return fail('no_email_claim');

  const audClaim = payload.aud;
  const aud = Array.isArray(audClaim) ? String(audClaim[0]) : String(audClaim ?? '');

  return { email, sub: typeof payload.sub === 'string' ? payload.sub : undefined, aud };
}

export function isFailure(x: Identity | AuthFailure): x is AuthFailure {
  return (x as AuthFailure).error instanceof Response;
}
