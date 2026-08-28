"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeOwnPassword } from "@/actions/auth";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";

export default function ChangePasswordForm() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (next !== confirm) { setError("ยืนยันรหัสผ่านใหม่ไม่ตรงกัน"); return; }
    startTransition(async () => { const result = await changeOwnPassword(current, next); if (!result.ok) { setError(result.error); return; } router.push("/"); router.refresh(); });
  }
  return <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-5 rounded-card bg-surface p-8 shadow-card"><div><h1 className="font-display text-2xl font-bold">ตั้งรหัสผ่านใหม่</h1><p className="mt-2 text-sm text-muted">รหัสผ่านต้องยาวอย่างน้อย 10 ตัว และมีตัวอักษรกับตัวเลข</p></div><Field label="รหัสผ่านปัจจุบัน" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required /><Field label="รหัสผ่านใหม่" type="password" value={next} onChange={(e) => setNext(e.target.value)} required /><Field label="ยืนยันรหัสผ่านใหม่" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />{error ? <p className="text-sm text-danger">{error}</p> : null}<Button type="submit" variant="dark" disabled={pending}>{pending ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}</Button></form>;
}
