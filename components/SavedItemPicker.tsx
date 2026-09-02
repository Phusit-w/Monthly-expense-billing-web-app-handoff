"use client";

import SearchSelect from "@/components/SearchSelect";
import type { SavedItemEntry } from "@/lib/types";

// Type-to-search "pick a saved expense row" trigger for the entry forms
// (EntryFormFA017 / EntryFormFA018). Picking one calls onPick with its
// Description; the caller fills that row's other fields from the match.
// Clears itself after a pick. Renders nothing when there is nothing saved.
export default function SavedItemPicker({
  savedItems,
  onPick,
  className,
}: {
  savedItems: SavedItemEntry[];
  onPick: (desc: string) => void;
  className?: string;
}) {
  if (savedItems.length === 0) return null;

  return (
    <SearchSelect
      options={savedItems.map((entry) => entry.desc)}
      onPick={onPick}
      placeholder="ค้นหา / เลือกรายการที่บันทึกไว้"
      className={className}
    />
  );
}
