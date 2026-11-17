// Canonical test for access.server.ts, copied verbatim next to it in the bun modules.
// Run with `bun test`.
//
// Only the refusals are tested here, because every one of them must happen before the
// app reaches out for Cloudflare's signing keys. A test that needed the network to say
// "no" would be testing the network.

import { describe, expect, test } from "bun:test";

import { extractAccessToken, verifyAccess } from "./access.server";

const AUD = "a".repeat(64);
const req = (headers: Record<string, string> = {}) =>
  new Request("https://module.rossiktools.com/", { headers });

// base64url of a JSON object, enough to build a token whose header says what we want.
const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const tokenWithAlg = (alg: string) => `${b64({ alg, typ: "JWT" })}.${b64({ email: "x@rossik.eu" })}.c2ln`;

describe("verifyAccess refuses before trusting anything", () => {
  test("with no audience configured, even a request carrying a token", async () => {
    // A deploy that forgot CF_ACCESS_AUD must lock everyone out, not let everyone in.
    const r = await verifyAccess(req({ "CF-Access-JWT-Assertion": tokenWithAlg("RS256") }), undefined);
    expect(r).toEqual({ ok: false, reason: "no_audience_configured" });
  });

  test("with an audience that is not a 64-hex Access tag", async () => {
    expect(await verifyAccess(req(), "it-inventory")).toEqual({ ok: false, reason: "no_audience_configured" });
  });

  test("with no token at all", async () => {
    expect(await verifyAccess(req(), AUD)).toEqual({ ok: false, reason: "missing_token" });
  });

  test("with something in the header that is not a JWT", async () => {
    const r = await verifyAccess(req({ "CF-Access-JWT-Assertion": "not-a-token-but-long-enough" }), AUD);
    expect(r).toEqual({ ok: false, reason: "malformed_token" });
  });

  test("with an unsigned or symmetric token, which anyone could mint", async () => {
    for (const alg of ["none", "HS256"]) {
      const r = await verifyAccess(req({ "CF-Access-JWT-Assertion": tokenWithAlg(alg) }), AUD);
      expect(r).toEqual({ ok: false, reason: "bad_alg" });
    }
  });
});

describe("extractAccessToken", () => {
  test("prefers the header Cloudflare sets over the cookie", () => {
    const t = extractAccessToken(
      req({ "CF-Access-JWT-Assertion": "h".repeat(30), Cookie: `CF_Authorization=${"c".repeat(30)}` }),
    );
    expect(t).toBe("h".repeat(30));
  });

  test("falls back to the CF_Authorization cookie", () => {
    expect(extractAccessToken(req({ Cookie: `theme=dark; CF_Authorization=${"c".repeat(30)}` }))).toBe("c".repeat(30));
  });

  test("returns null when neither is there", () => {
    expect(extractAccessToken(req({ Cookie: "theme=dark" }))).toBeNull();
  });
});
