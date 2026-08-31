"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

const PASSWORD_MIN_LENGTH = 6;

function meetsPolicy(v: string) {
  return v.length >= PASSWORD_MIN_LENGTH;
}

export default function ResetPasswordModal({
  open,
  user,
  pending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  user: { displayName: string; username: string } | null;
  pending: boolean;
  onConfirm: (newPassword: string) => void;
  onCancel: () => void;
}) {
  // Parent remounts this via `key` each time a reset is started, so the two
  // fields are always fresh — no effect needed to clear them.
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");

  const tooShort = pw.length > 0 && !meetsPolicy(pw);
  const mismatch = confirm.length > 0 && pw !== confirm;
  const valid = meetsPolicy(pw) && pw === confirm;
  const error = tooShort
    ? `รหัสผ่านต้องยาวอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัว`
    : mismatch
      ? "รหัสผ่านทั้งสองช่องไม่ตรงกัน"
      : "";

  return (
    <Modal open={open} onClose={onCancel} labelledBy="reset-pw-heading" width={420}>
      <div id="reset-pw-heading" className="mb-1 font-display text-base font-bold text-ink">
        รีเซ็ตรหัสผ่าน
      </div>
      <div className="mb-4 text-sm text-subtle">
        {user ? <>ตั้งรหัสผ่านใหม่ให้ <span className="font-medium text-ink">{user.displayName}</span> ({user.username})</> : null}
        <div className="mt-1 text-xs text-muted">
          ผู้ที่ใช้บัญชีนี้อยู่จะถูกให้ออกจากระบบ และต้อง login ใหม่ด้วยรหัสนี้
        </div>
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => { e.preventDefault(); if (valid && !pending) onConfirm(pw); }}
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          รหัสผ่านใหม่
          <input
            type="password"
            autoComplete="new-password"
            autoFocus
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="h-11 rounded-input border border-line bg-surface px-3 text-ink outline-none focus:border-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          ยืนยันรหัสผ่าน
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="h-11 rounded-input border border-line bg-surface px-3 text-ink outline-none focus:border-ink"
          />
        </label>
        {error ? <p role="alert" className="text-xs text-danger">{error}</p>
          : <p className="text-xs text-muted">อย่างน้อย {PASSWORD_MIN_LENGTH} ตัว</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={pending}>ยกเลิก</Button>
          <Button type="submit" size="sm" disabled={!valid || pending}>ยืนยันการรีเซ็ตรหัสผ่าน</Button>
        </div>
      </form>
    </Modal>
  );
}
