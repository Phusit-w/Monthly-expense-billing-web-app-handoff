"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import SavedEmployeePicker from "@/components/SavedEmployeePicker";
import SavedListManager from "@/components/SavedListManager";
import Card from "@/components/ui/Card";
import type { EmployeeSnapshot, SavedEmployeeEntry } from "@/lib/types";

const inputClass =
  "w-full rounded-field border border-line bg-surface px-4 py-3 text-sm text-ink outline-none " +
  "transition-[border-color,box-shadow] duration-150 " +
  "focus:border-[#181818] focus:shadow-[0_0_0_3px_rgb(0_0_0/0.04)]";

type EditableField = "name" | "position" | "department" | "employeeNo";

const FIELDS: { key: EditableField; label: string }[] = [
  { key: "name", label: "ชื่อ-นามสกุล" },
  { key: "position", label: "ตำแหน่ง / Position" },
  { key: "department", label: "ฝ่าย / แผนก" },
  { key: "employeeNo", label: "Employee No" },
];

// The one piece genuinely identical between EntryFormFA017 and
// EntryFormFA018 — same 4 fields, same labels. Office is deliberately not
// here (neither printed form exposes it) but the caller carries `office`
// through unedited; selecting a saved employee still updates it behind the
// scenes.
export default function EntryEmployeeFields({
  employee,
  onChange,
  savedEmployees,
  onSelectSaved,
  onSave,
  onDeleteSaved,
}: {
  employee: Pick<EmployeeSnapshot, EditableField>;
  onChange: (field: EditableField, value: string) => void;
  savedEmployees: SavedEmployeeEntry[];
  onSelectSaved: (saved: SavedEmployeeEntry) => void;
  onSave: () => Promise<void>;
  onDeleteSaved: (id: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [confirmingSave, setConfirmingSave] = useState(false);

  async function handleSave() {
    setConfirmingSave(false);
    setSaving(true);
    setJustSaved(false);
    await onSave();
    setSaving(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-base font-medium">ข้อมูลพนักงาน</div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setConfirmingSave(true)}
            disabled={saving || !employee.name.trim()}
            title={
              employee.name.trim()
                ? "บันทึกข้อมูลพนักงานชุดนี้ไว้ใช้ซ้ำ ค้นหาด้วยชื่อได้ในครั้งหน้า"
                : "กรอกชื่อ-นามสกุลก่อนจึงจะบันทึกได้"
            }
            className="ui-btn rounded-chip border border-dashed border-ink px-3.5 py-2 text-xs font-medium text-ink transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "กำลังบันทึก…"
              : justSaved
                ? "บันทึกแล้ว ✓"
                : "บันทึกไว้ใช้ซ้ำ"}
          </button>
          <SavedEmployeePicker
            savedEmployees={savedEmployees}
            onSelect={(saved) => {
              onChange("name", saved.name);
              onSelectSaved(saved);
            }}
          />
          <SavedListManager
            label="ชื่อที่บันทึกไว้"
            items={savedEmployees.map((s) => ({ id: s.id, text: s.name }))}
            onDelete={onDeleteSaved}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="mb-1.5 block text-[13px] font-medium text-label">
              {f.label}
            </label>
            <input
              value={employee[f.key]}
              onChange={(e) => onChange(f.key, e.target.value)}
              placeholder={f.key === "name" ? "ชื่อ-นามสกุล" : undefined}
              className={inputClass}
            />
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={confirmingSave}
        title="ยืนยันการบันทึกไว้ใช้ซ้ำ"
        message={
          savedEmployees.some((e) => e.name === employee.name.trim())
            ? "มีข้อมูลพนักงานชื่อนี้บันทึกไว้แล้ว — บันทึกซ้ำจะเขียนทับข้อมูลเดิม ต้องการดำเนินการต่อหรือไม่?"
            : "บันทึกข้อมูลพนักงานชุดนี้ไว้ใช้ซ้ำหรือไม่?"
        }
        confirmLabel="บันทึก"
        busy={saving}
        onConfirm={handleSave}
        onCancel={() => setConfirmingSave(false)}
      />
    </Card>
  );
}
