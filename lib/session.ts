import { cookies } from "next/headers";
import { SESSION_COOKIE, createSessionToken, verifySessionToken } from "@/lib/auth";
import type { SessionPayload } from "@/lib/auth";

// Cookie read/write glue for Server Actions/Components (uses next/headers'
// cookies(), only callable from that context — same constraint
// actions/profile.ts's rememberEmployeeName already works under). The
// signing/verification itself lives in lib/auth.ts so proxy.ts can read the
// same cookie without depending on next/headers.
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}
