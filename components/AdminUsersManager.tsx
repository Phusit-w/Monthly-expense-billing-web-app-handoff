"use client";

import { useState, useTransition } from "react";
import { createUser, resetUserPassword, setUserActive, setUserRole } from "@/actions/admin";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";

type AdminUser = { id: string; username: string; displayName: string; role: string; isActive: boolean; mustChangePassword: boolean; createdAt: string };
type ActionResult = { ok: boolean; error?: string; temporaryPassword?: string; username?: string };

function messageFor(result: ActionResult) {
  if (!result.ok) return result.error ?? "ไม่สำเร็จ";
  if (result.temporaryPassword) return `รหัสผ่านชั่วคราว (แสดงครั้งเดียว): ${result.temporaryPassword}`;
  if (result.username) return `รีเซ็ตรหัสผ่าน ${result.username} แล้ว — ผู้ที่ใช้บัญชีนี้อยู่จะถูกให้ login ใหม่ด้วยรหัสใหม่`;
  return "บันทึกเรียบร้อย";
}

export default function AdminUsersManager({ users }: { users: AdminUser[] }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const show = (r: ActionResult) => setMessage(messageFor(r));

  return <div className="space-y-6">
    <form className="grid gap-4 rounded-card border border-line bg-surface p-5 md:grid-cols-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await createUser({ username, displayName, role }); show(r); if (r.ok) { setUsername(""); setDisplayName(""); } }); }}>
      <Field label="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
      <Field label="ชื่อที่แสดง" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      <label className="text-[13px] font-medium text-label">Role<select className="mt-1.5 h-[52px] w-full rounded-field border border-line bg-surface px-4 text-sm" value={role} onChange={(e) => setRole(e.target.value as "USER" | "ADMIN")}><option>USER</option><option>ADMIN</option></select></label>
      <Button type="submit" className="self-end" disabled={pending}>เพิ่มผู้ใช้</Button>
    </form>
    {message ? <div className="rounded-field border border-line bg-chip p-4 text-sm font-medium">{message}</div> : null}
    <div className="overflow-x-auto rounded-card border border-line bg-surface"><table className="w-full text-left text-sm"><thead className="border-b border-line bg-chip"><tr><th className="p-4">ผู้ใช้</th><th className="p-4">Role</th><th className="p-4">สถานะ</th><th className="p-4">จัดการ</th></tr></thead><tbody>
      {users.map((u) => <UserRow key={u.id} user={u} pending={pending} start={start} onResult={show} />)}
    </tbody></table></div>
  </div>;
}

function UserRow({ user: u, pending, start, onResult }: {
  user: AdminUser;
  pending: boolean;
  start: (cb: () => Promise<void>) => void;
  onResult: (r: ActionResult) => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const canReset = newPassword.trim().length > 0;

  return <tr className="border-b border-line last:border-0 align-top">
    <td className="p-4"><div className="font-medium">{u.displayName}</div><div className="text-muted">{u.username}{u.mustChangePassword ? " · รอเปลี่ยนรหัสผ่าน" : ""}</div></td>
    <td className="p-4"><select className="rounded-input border border-line bg-surface p-2" value={u.role} disabled={pending} onChange={(e) => start(async () => onResult(await setUserRole(u.id, e.target.value as "USER" | "ADMIN")))}><option>USER</option><option>ADMIN</option></select></td>
    <td className="p-4">{u.isActive ? "ใช้งาน" : "ปิดใช้งาน"}</td>
    <td className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="รหัสผ่านใหม่"
          autoComplete="off"
          className="w-52 rounded-input border border-line bg-surface p-2 text-sm"
        />
        <Button size="sm" variant="outline" disabled={pending || !canReset} onClick={() => start(async () => {
          const r = await resetUserPassword(u.id, newPassword.trim());
          onResult(r);
          if (r.ok) setNewPassword("");
        })}>รีเซ็ตรหัสผ่าน</Button>
        <Button size="sm" variant={u.isActive ? "danger" : "outline"} disabled={pending} onClick={() => start(async () => onResult(await setUserActive(u.id, !u.isActive)))}>{u.isActive ? "ปิดบัญชี" : "เปิดบัญชี"}</Button>
      </div>
      <p className="mt-1 text-[11px] text-muted">กรอกรหัสผ่านใหม่ (อย่างน้อย 10 ตัว มีตัวอักษรกับตัวเลข) แล้วกดรีเซ็ต · ผู้ที่ใช้บัญชีนี้อยู่จะต้อง login ใหม่</p>
    </td>
  </tr>;
}
