"use client";

import type { SavedEmployeeEntry } from "@/lib/types";

// Explicit "pick from saved" control, shared by EntryEmployeeFields.tsx and
// ProfileCard.tsx (previously each had its own copy). Replaces the old
// type-to-autocomplete <datalist> on the ชื่อ-นามสกุล field, which wasn't
// discoverable enough (same reasoning as the compact print forms' picker
// <select>, see FA017Form.tsx/FA018Form.tsx). Sits next to each card's
// "บันทึกไว้ใช้ซ้ำ" button rather than the input itself. Picking an option
// still fills in the rest of that person's saved details via onSelect; value
// always resets to "" right after a pick so this stays a reusable trigger
// rather than displaying whatever was last chosen.
export default function SavedEmployeePicker({
  savedEmployees,
  onSelect,
}: {
  savedEmployees: SavedEmployeeEntry[];
  onSelect: (saved: SavedEmployeeEntry) => void;
}) {
  return (
    <select
      value=""
      onChange={(e) => {
        const name = e.target.value;
        if (!name) return;
        const saved = savedEmployees.find((s) => s.name === name);
        if (saved) onSelect(saved);
        e.target.value = "";
      }}
      disabled={savedEmployees.length === 0}
      title="เลือกรายชื่อพนักงานที่เคยบันทึกไว้"
      style={{
        marginTop: 6,
        padding: "5px 8px",
        border: "1px dashed #1c1c1c",
        borderRadius: 4,
        background: "#fff",
        font: "inherit",
        fontSize: 11,
        color: "#1c1c1c",
        cursor: savedEmployees.length === 0 ? "not-allowed" : "pointer",
        opacity: savedEmployees.length === 0 ? 0.5 : 1,
      }}
    >
      <option value="">เลือกรายชื่อที่บันทึกไว้ ▾</option>
      {savedEmployees.map((s) => (
        <option key={s.name} value={s.name}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
