"use client";

import type { SavedEmployeeEntry } from "@/lib/types";

// Explicit "pick from saved" control, shared by EntryEmployeeFields.tsx and
// ProfileCard.tsx. Picking an option fills in the rest of that person's
// saved details via onSelect; value always resets to "" right after a pick
// so this stays a reusable trigger rather than displaying the last choice.
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
      className="rounded-chip border border-line bg-surface px-3.5 py-2 text-xs font-medium text-label
        disabled:cursor-not-allowed disabled:opacity-50"
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
