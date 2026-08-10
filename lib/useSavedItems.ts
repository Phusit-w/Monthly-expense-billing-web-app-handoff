"use client";

import { useState } from "react";
import { deleteSavedItem, saveItemForReuse } from "@/actions/savedItems";
import type { FA017Item, FA018Item, RecordType, SavedItemEntry } from "@/lib/types";

// Shared client-side bookkeeping for the "save an expense-item row, pick it
// back out (or delete it) by its Description next time" feature (see
// prisma/schema.prisma's SavedItem model) — used by both the roomy entry
// forms (EntryFormFA017/018) and the compact print forms (FA017Form/
// FA018Form), which otherwise have no component in common. Keeps its own
// local copy of the server-fetched `initial` list and appends/updates/
// removes it optimistically after a successful save/delete, so a change
// made in one place is immediately reflected elsewhere on the same page
// without waiting on a full page reload (the entry forms' employee-reuse
// feature — EntryEmployeeFields — doesn't do this today, but there the save
// target is a single shared default; here every row is a distinct,
// independently useful template, so the immediate-reuse case is much more
// likely to come up in one sitting).
export function useSavedItems(type: RecordType, initial: SavedItemEntry[]) {
  const [items, setItems] = useState<SavedItemEntry[]>(initial);

  // Exact-match lookup, same mechanism EntryEmployeeFields/ProfileCard
  // already use for "typed/picked a saved name from the datalist" — only
  // fires once the field's value exactly equals a saved entry's key.
  function findMatch(desc: string): SavedItemEntry | undefined {
    return items.find((entry) => entry.desc === desc);
  }

  async function save(item: FA017Item | FA018Item) {
    const saved = await saveItemForReuse(type, item);
    if (!saved) return; // blank desc — saveItemForReuse no-oped
    setItems((its) => {
      const next = its.filter((entry) => entry.desc !== saved.desc);
      next.push(saved);
      next.sort((a, b) => a.desc.localeCompare(b.desc, "th"));
      return next;
    });
  }

  async function remove(id: string) {
    await deleteSavedItem(id);
    setItems((its) => its.filter((entry) => entry.id !== id));
  }

  return { items, findMatch, save, remove };
}
