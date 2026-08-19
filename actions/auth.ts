"use server";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { setSessionCookie, clearSessionCookie, getCurrentUser } from "@/lib/session";

// Returns a discriminated result rather than throwing/redirecting itself
// (same pattern as actions/records.ts's saveRecord) — the caller (a client
// component) decides what happens next (redirect, show the error inline).
export async function login(
  username: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmedUsername = username.trim();
  if (!trimmedUsername || !password) {
    return { ok: false, error: "กรุณากรอก username และ password" };
  }

  const user = await prisma.user.findUnique({ where: { username: trimmedUsername } });
  // Same generic message whether the username doesn't exist or the
  // password is wrong — distinguishing the two would let someone probe
  // which usernames are valid.
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { ok: false, error: "username หรือ password ไม่ถูกต้อง" };
  }

  await setSessionCookie({
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
  });
  return { ok: true };
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
}

// Header.tsx ("use client") needs the logged-in user's displayName to show
// next to "ออกจากระบบ" — getCurrentUser() itself (lib/session.ts) uses
// next/headers' cookies() and so can only run in a Server Component/Action,
// not be imported straight into client code. This is that thin bridge,
// same pattern login()/logout() above already establish for this file.
export async function getCurrentUserInfo(): Promise<{ displayName: string } | null> {
  const user = await getCurrentUser();
  return user ? { displayName: user.displayName } : null;
}
