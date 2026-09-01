"use client";

import SearchSelect from "@/components/SearchSelect";
import type { SavedEmployeeEntry } from "@/lib/types";

// Type-to-search "pick from saved" control, shared by EntryEmployeeFields.tsx
// and ProfileCard.tsx. Picking an entry fills in the rest of that person's
// saved details via onSelect; the field clears itself after a pick so it
// stays a reusable trigger.
export default function SavedEmployeePicker({
  savedEmployees,
  onSelect,
}: {
  savedEmployees: SavedEmployeeEntry[];
  onSelect: (saved: SavedEmployeeEntry) => void;
}) {
  return (
    <SearchSelect
      options={savedEmployees.map((s) => s.name)}
      onPick={(name) => {
        const saved = savedEmployees.find((s) => s.name === name);
        if (saved) onSelect(saved);
      }}
      disabled={savedEmployees.length === 0}
      placeholder="ค้นหา / เลือกรายชื่อที่บันทึกไว้"
      className="w-[220px] max-w-full rounded-chip border border-line bg-surface px-3.5 py-2 text-xs font-medium text-label
        outline-none focus:border-ink focus:shadow-[0_0_0_3px_var(--ring-focus)]
        disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}
