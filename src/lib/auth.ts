/**
 * Lightweight single-practitioner dashboard auth.
 *
 * Credentials come from env: PRACTITIONER_EMAIL + DASHBOARD_PASSWORD. On a
 * successful sign-in we issue a signed (HMAC-SHA256) session token stored in an
 * httpOnly cookie. This module is pure/isomorphic (Web Crypto only, no
 * next/headers) so it can run in both the Edge middleware and Node server code.
 */
import { env } from "./env";

export const SESSION_COOKIE = "shh_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days (seconds)

/** Whether a dashboard password has been configured. */
export function dashboardConfigured(): boolean {
  return Boolean(env.dashboardPassword);
}

/** Constant-time(ish) comparison of two equal-length strings. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Validate submitted login credentials against the configured env values. */
export function verifyCredentials(email: string, password: string): boolean {
  if (!env.dashboardPassword) return false;
  const emailOk =
    email.trim().toLowerCase() === env.practitionerEmail.trim().toLowerCase();
  const passOk = safeEqual(password, env.dashboardPassword);
  return emailOk && passOk;
}

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function b64url(input: string): string {
  // ASCII JSON only, so btoa is safe in both Edge and Node.
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded);
}

async function hmac(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toHex(sig);
}

/** Create a signed session token valid for SESSION_MAX_AGE. */
export async function createSessionToken(): Promise<string> {
  const secret = env.dashboardPassword!;
  const payload = b64url(
    JSON.stringify({
      sub: "practitioner",
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
    }),
  );
  const sig = await hmac(payload, secret);
  return `${payload}.${sig}`;
}

/** Verify a session token's signature and expiry. */
export async function isValidSessionToken(token: string | undefined): Promise<boolean> {
  if (!token || !env.dashboardPassword) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;

  const expected = await hmac(payload, env.dashboardPassword);
  if (!safeEqual(sig, expected)) return false;

  try {
    const data = JSON.parse(b64urlDecode(payload)) as { exp?: number };
    return typeof data.exp === "number" && data.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
