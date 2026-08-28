"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { setSessionCookie, clearSessionCookie, getCurrentUser } from "@/lib/session";
import { writeAudit } from "@/lib/authorization";

// Returns a discriminated result rather than throwing/redirecting itself
// (same pattern as actions/records.ts's saveRecord) — the caller (a client
// component) decides what happens next (redirect, show the error inline).
export async function login(
  username: string,
  password: string
): Promise<{ ok: true; mustChangePassword: boolean } | { ok: false; error: string }> {
  const trimmedUsername = username.trim();
  if (!trimmedUsername || !password) {
    return { ok: false, error: "กรุณากรอก username และ password" };
  }

  const user = await prisma.user.findUnique({ where: { username: trimmedUsername } });
  // Same generic message whether the username doesn't exist or the
  // password is wrong — distinguishing the two would let someone probe
  // which usernames are valid.
  if (!user || !verifyPassword(password, user.passwordHash)) {
    await writeAudit({ actorId: user?.id, targetUserId: user?.id, action: "LOGIN_FAILED", entityType: "USER", entityId: user?.id, summary: `เข้าสู่ระบบไม่สำเร็จ: ${trimmedUsername}`, metadata: { username: trimmedUsername } });
    return { ok: false, error: "username หรือ password ไม่ถูกต้อง" };
  }
  if (!user.isActive) {
    await writeAudit({ actorId: user.id, targetUserId: user.id, action: "LOGIN_BLOCKED", entityType: "USER", entityId: user.id, summary: "บัญชีถูกปิดใช้งานพยายามเข้าสู่ระบบ" });
    return { ok: false, error: "บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ" };
  }

  await setSessionCookie({
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    sessionVersion: user.sessionVersion,
  });
  await writeAudit({ actorId: user.id, targetUserId: user.id, action: "LOGIN_SUCCEEDED", entityType: "USER", entityId: user.id, summary: "เข้าสู่ระบบสำเร็จ" });
  return { ok: true, mustChangePassword: user.mustChangePassword };
}

export async function logout(): Promise<void> {
  const user = await getCurrentUser();
  if (user) await writeAudit({ actorId: user.id, targetUserId: user.id, action: "LOGOUT", entityType: "USER", entityId: user.id, summary: "ออกจากระบบ" });
  await clearSessionCookie();
}

export async function changeOwnPassword(currentPassword: string, nextPassword: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };
  if (!verifyPassword(currentPassword, user.passwordHash)) return { ok: false as const, error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
  if (nextPassword.length < 10 || !/[A-Za-z]/.test(nextPassword) || !/\d/.test(nextPassword)) return { ok: false as const, error: "รหัสผ่านใหม่ต้องยาวอย่างน้อย 10 ตัว และมีตัวอักษรกับตัวเลข" };
  if (currentPassword === nextPassword) return { ok: false as const, error: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม" };
  const updated = await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(nextPassword), mustChangePassword: false, passwordChangedAt: new Date(), sessionVersion: { increment: 1 } } });
  await setSessionCookie({ userId: updated.id, username: updated.username, displayName: updated.displayName, sessionVersion: updated.sessionVersion });
  await writeAudit({ actorId: user.id, targetUserId: user.id, action: "PASSWORD_CHANGED", entityType: "USER", entityId: user.id, summary: "เปลี่ยนรหัสผ่านของตนเอง" });
  return { ok: true as const };
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
