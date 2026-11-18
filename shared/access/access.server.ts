// Cloudflare Access verification for a rossik-tools Worker or Pages Function.
//
// CANONICAL COPY: rossik-tools/.github shared/access/access.server.ts. Every module keeps a
// verbatim copy and its CI fails when the copy differs. Change it here, then copy it into every
// module in the same round. Never edit a module's copy. Module-specific notes belong next to the
// import, not in this file.
//
// The Access application in front of the module is the perimeter; this file is the second lock,
// because the perimeter has gaps a header alone cannot close: a workers.dev or preview URL that
// skips Access, or a request that simply forges the CF-Access-JWT-Assertion header. The presence
// of the header proves nothing. Only a token whose RS256 signature verifies against the team's
// keys, with the exact issuer and this app's audience, does.
//
// Same rules as rossik-tools/portal infra/supabase/functions/_shared/access-auth.ts (the edge
// function side). Fail closed everywhere: no audience configured, no token, any verification
// error -> deny.

import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from "jose";

// Trust root, hardcoded on purpose: the issuer and key URL must never come from config,
// or whoever can set a variable can point verification at their own key server.
const CF_ISSUER = "https://rossiktools.cloudflareaccess.com";
const JWKS = createRemoteJWKSet(new URL(`${CF_ISSUER}/cdn-cgi/access/certs`));
const CLOCK_SKEW_S = 60;
const AUD_RE = /^[0-9a-f]{64}$/;

export type AccessResult = { ok: true; email: string } | { ok: false; reason: string };

/** The Access token from the header Cloudflare sets, else the cookie. Header wins. */
export function extractAccessToken(req: Request): string | null {
  const header = req.headers.get("CF-Access-JWT-Assertion");
  if (header && header.length > 20) return header.trim();
  const cookie = req.headers.get("Cookie") ?? "";
  const m = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  const value = m?.[1];
  if (!value) return null;
  // decodeURIComponent throws on a malformed escape ("%"), and this runs before anything is
  // verified. A cookie that cannot be decoded is simply not a token: deny cleanly, never 500.
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * Verify the request's Access token against this app's audience tag.
 *
 * `aud` pins which Access application may authorise this app. Without it, a validly signed
 * token minted for any other app in the team would open this one too.
 */
export async function verifyAccess(req: Request, aud: string | undefined): Promise<AccessResult> {
  if (!aud || !AUD_RE.test(aud)) return { ok: false, reason: "no_audience_configured" };

  const token = extractAccessToken(req);
  if (!token) return { ok: false, reason: "missing_token" };

  try {
    if (decodeProtectedHeader(token).alg !== "RS256") return { ok: false, reason: "bad_alg" };
  } catch {
    return { ok: false, reason: "malformed_token" };
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: CF_ISSUER,
      audience: aud,
      clockTolerance: CLOCK_SKEW_S,
      algorithms: ["RS256"],
    });
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    // Service tokens carry no email. No module accepts an automated caller through this file.
    if (!email.includes("@")) return { ok: false, reason: "no_email_claim" };
    return { ok: true, email };
  } catch {
    // Bad signature, unknown key, key fetch failure, wrong issuer or audience, expired.
    return { ok: false, reason: "verification_failed" };
  }
}
