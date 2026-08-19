"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import SavedEmployeePicker from "@/components/SavedEmployeePicker";
import SavedListManager from "@/components/SavedListManager";
import type { EmployeeSnapshot, SavedEmployeeEntry } from "@/lib/types";

// Styling ported from ProfileCard.tsx's plain-input pattern (as opposed to
// FA017Form/FA018Form's dense pixel-table inputs) — this is the "roomy" look
// the whole entry flow uses.
const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px 8px",
  border: "1px solid #ccc",
  borderRadius: 4,
  font: "inherit",
};

const fieldWrap = (minWidth: number): React.CSSProperties => ({
  flex: 1,
  minWidth,
});

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "#555",
  marginBottom: 4,
};

type EditableField = "name" | "position" | "department" | "employeeNo";

const FIELDS: { key: EditableField; label: string; minWidth: number }[] = [
  { key: "name", label: "ชื่อ-นามสกุล", minWidth: 200 },
  { key: "position", label: "ตำแหน่ง / Position", minWidth: 160 },
  { key: "department", label: "ฝ่าย / แผนก", minWidth: 160 },
  { key: "employeeNo", label: "Employee No", minWidth: 140 },
];

// The one piece genuinely identical between EntryFormFA017 and
// EntryFormFA018 — same 4 fields, same labels. Office is deliberately not
// here: neither FA017Form nor FA018Form exposes an editable Office field
// (FA017Form prints a hardcoded company name; FA018Form doesn't show it at
// all) — but the caller must still carry `office` through unedited in the
// full EmployeeSnapshot it hands to onCreate, since saveRecord writes
// draft.employee.office to the DB unconditionally. Selecting a saved
// employee (below) still updates office behind the scenes even though
// there's no visible field for it, same as it already flows through today.
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
  // Several different people share this login-less app — savedEmployees is
  // the list anyone has previously saved under their own name via "บันทึกไว้
  // ใช้ซ้ำ" below, distinct from the one org-wide default (ProfileCard on the
  // history page). Picked via SavedEmployeePicker next to that button, which
  // reuses the rest of that person's saved details immediately.
  savedEmployees: SavedEmployeeEntry[];
  onSelectSaved: (saved: SavedEmployeeEntry) => void;
  onSave: () => Promise<void>;
  onDeleteSaved: (id: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  // onSave (saveEmployeeForReuse, actions/profile.ts) upserts keyed by name,
  // so re-saving an existing one silently overwrites it — confirm first.
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
    <div
      style={{
        background: "#fff",
        border: "1px solid #d8d5cc",
        borderRadius: 8,
        padding: "18px 22px",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>ข้อมูลพนักงาน</div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
        {FIELDS.map((f) => (
          <div key={f.key} style={fieldWrap(f.minWidth)}>
            <label style={labelStyle}>{f.label}</label>
            <input
              value={employee[f.key]}
              onChange={(e) => onChange(f.key, e.target.value)}
              placeholder={f.key === "name" ? "ชื่อ-นามสกุล" : undefined}
              style={inputStyle}
            />
            {f.key === "name" && (
              <>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setConfirmingSave(true)}
                    disabled={saving || !employee.name.trim()}
                    title={
                      employee.name.trim()
                        ? "บันทึกข้อมูลพนักงานชุดนี้ไว้ใช้ซ้ำ ค้นหาด้วยชื่อได้ในครั้งหน้า"
                        : "กรอกชื่อ-นามสกุลก่อนจึงจะบันทึกได้"
                    }
                    style={{
                      marginTop: 6,
                      padding: "5px 10px",
                      border: "1px dashed #1c1c1c",
                      borderRadius: 4,
                      background: "#fff",
                      font: "inherit",
                      fontSize: 11,
                      color: "#1c1c1c",
                      cursor: saving || !employee.name.trim() ? "not-allowed" : "pointer",
                      opacity: saving || !employee.name.trim() ? 0.5 : 1,
                    }}
                  >
                    {saving ? "กำลังบันทึก…" : justSaved ? "บันทึกแล้ว ✓" : "บันทึกไว้ใช้ซ้ำ"}
                  </button>
                  <SavedEmployeePicker
                    savedEmployees={savedEmployees}
                    onSelect={(saved) => {
                      onChange("name", saved.name);
                      onSelectSaved(saved);
                    }}
                  />
                </div>
                <div style={{ marginTop: 6 }}>
                  <SavedListManager
                    label="ชื่อที่บันทึกไว้"
                    items={savedEmployees.map((s) => ({ id: s.id, text: s.name }))}
                    onDelete={onDeleteSaved}
                  />
                </div>
              </>
            )}
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
    </div>
  );
}
