"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, writeAudit } from "@/lib/authorization";

function temporaryPassword() {
  return `Icn-${randomBytes(9).toString("base64url")}7`;
}

export async function createUser(input: { username: string; displayName: string; role: "USER" | "ADMIN" }) {
  const actor = await requireRole("ADMIN");
  const username = input.username.trim().toLowerCase();
  const displayName = input.displayName.trim();
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) return { ok: false as const, error: "Username ต้องเป็น a-z, 0-9, จุด ขีดกลาง หรือขีดล่าง 3–40 ตัว" };
  if (displayName.length < 2) return { ok: false as const, error: "กรุณาระบุชื่อที่แสดง" };
  if (await prisma.user.findUnique({ where: { username } })) return { ok: false as const, error: "Username นี้มีอยู่แล้ว" };
  const password = temporaryPassword();
  const user = await prisma.user.create({ data: { username, displayName, role: input.role, passwordHash: hashPassword(password), mustChangePassword: true } });
  await writeAudit({ actorId: actor.id, targetUserId: user.id, action: "USER_CREATED", entityType: "USER", entityId: user.id, summary: `สร้างผู้ใช้ ${username}`, after: { role: user.role, isActive: true } });
  revalidatePath("/admin"); revalidatePath("/admin/users");
  return { ok: true as const, temporaryPassword: password };
}

export async function setUserActive(userId: string, isActive: boolean) {
  const actor = await requireRole("ADMIN");
  if (!isActive && userId === actor.id) return { ok: false as const, error: "ไม่สามารถปิดบัญชีของตนเอง" };
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!isActive && target.role === "ADMIN" && await prisma.user.count({ where: { role: "ADMIN", isActive: true } }) <= 1) return { ok: false as const, error: "ต้องมี Admin ที่ใช้งานได้อย่างน้อย 1 คน" };
  const user = await prisma.user.update({ where: { id: userId }, data: { isActive, disabledAt: isActive ? null : new Date(), sessionVersion: { increment: 1 } } });
  await writeAudit({ actorId: actor.id, targetUserId: user.id, action: isActive ? "USER_ENABLED" : "USER_DISABLED", entityType: "USER", entityId: user.id, summary: `${isActive ? "เปิด" : "ปิด"}บัญชี ${user.username}`, before: { isActive: target.isActive }, after: { isActive } });
  revalidatePath("/admin/users"); return { ok: true as const };
}

export async function setUserRole(userId: string, role: "USER" | "ADMIN") {
  const actor = await requireRole("ADMIN");
  if (userId === actor.id && role !== "ADMIN") return { ok: false as const, error: "ไม่สามารถลดสิทธิ์ของตนเอง" };
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (target.role === "ADMIN" && role === "USER" && target.isActive && await prisma.user.count({ where: { role: "ADMIN", isActive: true } }) <= 1) return { ok: false as const, error: "ต้องมี Admin ที่ใช้งานได้อย่างน้อย 1 คน" };
  const user = await prisma.user.update({ where: { id: userId }, data: { role, sessionVersion: { increment: 1 } } });
  await writeAudit({ actorId: actor.id, targetUserId: user.id, action: "USER_ROLE_CHANGED", entityType: "USER", entityId: user.id, summary: `เปลี่ยนสิทธิ์ ${user.username} เป็น ${role}`, before: { role: target.role }, after: { role } });
  revalidatePath("/admin/users"); return { ok: true as const };
}

function isStrongPassword(value: string) {
  // same rule as the self-service /change-password flow (actions/auth.ts)
  return value.length >= 10 && /[A-Za-z]/.test(value) && /\d/.test(value);
}

export async function resetUserPassword(userId: string, opts?: { newPassword?: string; keepPassword?: boolean }) {
  const actor = await requireRole("ADMIN");
  const custom = opts?.newPassword?.trim();

  if (custom) {
    if (!isStrongPassword(custom)) return { ok: false as const, error: "รหัสผ่านต้องยาวอย่างน้อย 10 ตัว และมีตัวอักษรกับตัวเลข" };
    const forceChange = !opts?.keepPassword;
    const user = await prisma.user.update({ where: { id: userId }, data: { passwordHash: hashPassword(custom), mustChangePassword: forceChange, sessionVersion: { increment: 1 } } });
    await writeAudit({ actorId: actor.id, targetUserId: user.id, action: "USER_PASSWORD_RESET", entityType: "USER", entityId: user.id, summary: `ตั้งรหัสผ่านให้ ${user.username}${forceChange ? "" : " (ใช้ได้เลย ไม่บังคับเปลี่ยน)"}` });
    revalidatePath("/admin/users");
    return { ok: true as const, adminSet: true, forceChange };
  }

  const password = temporaryPassword();
  const user = await prisma.user.update({ where: { id: userId }, data: { passwordHash: hashPassword(password), mustChangePassword: true, sessionVersion: { increment: 1 } } });
  await writeAudit({ actorId: actor.id, targetUserId: user.id, action: "USER_PASSWORD_RESET", entityType: "USER", entityId: user.id, summary: `รีเซ็ตรหัสผ่าน ${user.username}` });
  revalidatePath("/admin/users");
  return { ok: true as const, temporaryPassword: password };
}

export async function restoreExpense(id: string) {
  const actor = await requireRole("ADMIN");
  const row = await prisma.expenseRecord.update({ where: { id }, data: { deletedAt: null, deletedById: null, purgeAfter: null, restoredAt: new Date() } });
  await writeAudit({ actorId: actor.id, action: "EXPENSE_RESTORED", entityType: "EXPENSE", entityId: id, summary: `กู้คืนเอกสาร ${row.type}` });
  revalidatePath("/admin/trash"); revalidatePath("/records");
}

export async function restoreSocJob(id: string) {
  const actor = await requireRole("ADMIN");
  const row = await prisma.socJob.update({ where: { id }, data: { deletedAt: null, deletedById: null, purgeAfter: null, restoredAt: new Date() } });
  await writeAudit({ actorId: actor.id, action: "SOC_RESTORED", entityType: "SOC_JOB", entityId: id, summary: `กู้คืนงาน SOC ${row.title}` });
  revalidatePath("/admin/trash"); revalidatePath("/soc");
}
