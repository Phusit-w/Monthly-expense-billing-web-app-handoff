import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

// Password hashing (PBKDF2-SHA256) and session-token signing for per-user
// login (see proxy.ts, actions/auth.ts, lib/session.ts). Next.js 16 runs
// `proxy.ts` in the Node.js runtime by default (unlike older versions'
// Edge-only middleware — see node_modules/next/dist/docs/.../proxy.md's
// "Runtime" section), so this can lean on node:crypto directly rather than
// needing Web Crypto for edge-runtime compatibility.
//
// No third-party hashing/JWT library (bcrypt, jsonwebtoken, NextAuth, ...):
// this app already has zero auth dependencies and a small, stable user
// count (see docs/PROJECT-OVERVIEW.md) — node:crypto's built-ins cover both
// needs without adding one.

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 32;

// Stored as `${iterations}$${saltBase64}$${hashBase64}` — iterations is
// embedded so a future bump to PBKDF2_ITERATIONS doesn't invalidate
// passwords hashed under the old value.
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha256");
  return `${PBKDF2_ITERATIONS}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [iterStr, saltB64, hashB64] = stored.split("$");
  const iterations = Number(iterStr);
  if (!iterations || !saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const actual = pbkdf2Sync(password, salt, iterations, expected.length, "sha256");
  // timingSafeEqual throws on length mismatch rather than returning false,
  // so check lengths first.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const SESSION_COOKIE = "session";

export interface SessionPayload {
  userId: string;
  username: string;
  displayName: string;
  sessionVersion: number;
}

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return secret;
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

// `${base64url(JSON payload)}.${base64url(HMAC-SHA256 signature)}` — plain
// signed cookie, not JWT (no header/alg negotiation to get wrong, and this
// app only ever verifies tokens it signed itself).
export function createSessionToken(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, sessionSecret())}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  let secret: string;
  try {
    secret = sessionSecret();
  } catch {
    return null;
  }

  const expected = Buffer.from(sign(body, secret));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.userId || !payload.username || !payload.displayName || !Number.isInteger(payload.sessionVersion)) return null;
    return payload;
  } catch {
    return null;
  }
}
