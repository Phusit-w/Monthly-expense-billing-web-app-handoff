"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";

export default function EditUsernameModal({
  open,
  user,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  user: { displayName: string; username: string } | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (username: string) => void;
}) {
  const [username, setUsername] = useState(user?.username ?? "");

  return (
    <Modal open={open} onClose={onCancel} labelledBy="edit-username-heading" width={440}>
      <div id="edit-username-heading" className="font-display text-base font-bold text-ink">
        เปลี่ยน Username
      </div>
      <p className="mb-4 mt-1 text-sm text-muted">
        {user ? `${user.displayName} (${user.username})` : ""}
      </p>
      <Field
        label="Username ใหม่"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        autoComplete="off"
        disabled={pending}
        required
      />
      <p className="mt-3 text-xs leading-5 text-muted">
        ใช้ a–z, 0–9, จุด ขีดกลาง หรือขีดล่าง จำนวน 3–40 ตัว บัญชีนี้จะถูกออกจากระบบทุกอุปกรณ์และต้องเข้าสู่ระบบด้วย Username ใหม่
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={pending}>
          ยกเลิก
        </Button>
        <Button
          variant="dark"
          size="sm"
          onClick={() => onConfirm(username)}
          disabled={pending || !username.trim() || username.trim().toLowerCase() === user?.username}
        >
          {pending ? "กำลังบันทึก…" : "ยืนยันเปลี่ยน Username"}
        </Button>
      </div>
    </Modal>
  );
}

