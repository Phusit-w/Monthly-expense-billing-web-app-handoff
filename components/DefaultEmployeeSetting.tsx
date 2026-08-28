"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rememberLastEmployee } from "@/actions/profile";
import SavedEmployeePicker from "@/components/SavedEmployeePicker";
import type { SavedEmployeeEntry } from "@/lib/types";

// The "ค่าเริ่มต้นผู้กรอก" control on /settings. Picking a saved name writes
// the per-browser `lastEmployeeName` cookie (actions/profile.ts's
// rememberLastEmployee) — the same default ProfileCard on /records and the
// entry forms prefill from. Deliberately narrower than ProfileCard: no
// editable fields, no save-for-reuse, no delete — just "which saved person
// does this computer start as".
export default function DefaultEmployeeSetting({
  currentName,
  savedEmployees,
}: {
  currentName: string;
  savedEmployees: SavedEmployeeEntry[];
}) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [justSaved, setJustSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function selectSaved(saved: SavedEmployeeEntry) {
    startTransition(async () => {
      await rememberLastEmployee(saved.name);
      setName(saved.name);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
      // Pull the freshly-set cookie through to anything else the shell has
      // already rendered from getProfile() (e.g. /records' ProfileCard).
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="text-label">ค่าเริ่มต้นปัจจุบัน:</span>
        <span className="font-medium text-ink">
          {name || "— ยังไม่ได้ตั้ง —"}
        </span>
        {pending && <span className="text-xs text-muted">กำลังบันทึก…</span>}
        {justSaved && !pending && (
          <span className="text-xs font-medium text-subtle">บันทึกแล้ว ✓</span>
        )}
      </div>

      {savedEmployees.length > 0 ? (
        <SavedEmployeePicker
          savedEmployees={savedEmployees}
          onSelect={selectSaved}
        />
      ) : (
        <p className="text-[13px] text-muted">
          ยังไม่มีชื่อพนักงานที่บันทึกไว้ — กด “บันทึกไว้ใช้ซ้ำ” ในหน้ากรอกข้อมูลก่อน
          แล้วจึงจะเลือกตั้งเป็นค่าเริ่มต้นได้ที่นี่
        </p>
      )}
    </div>
  );
}
