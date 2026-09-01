// Per-tab crash/reload recovery for the bill editor's in-memory draft.
//
// BillEditor keeps the whole draft in React state — a reload, a tab-restore,
// or clicking through the "Leave site?" prompt otherwise throws away
// everything typed since the last "บันทึก". This stashes the draft in
// sessionStorage on every change and restores it on mount, so those cases
// come back intact. sessionStorage (not localStorage) on purpose: it's
// scoped to the one tab and cleared when that tab closes, so a recovered
// draft can never be a surprise leftover from a different session or window.
//
// Cleared explicitly on the deliberate exits (save succeeds, "ยกเลิก",
// confirmed "← ย้อนกลับ", the recovery banner's "เริ่มใหม่") — NOT on a
// reload or a browser-Back "leave", which are exactly the cases the restore
// is meant to survive.
import type { Draft } from "@/lib/types";

const PREFIX = "bill-draft:";

// Stable per "what is being edited": the saved record's id, or (for an
// unsaved draft) its type — matches how /bill/[id] vs /bill/new/[type] and
// EntryFlow's handoff draft differ.
export function billDraftKey(d: { id: string | null; type: string }): string {
  return PREFIX + (d.id ?? `new:${d.type}`);
}

export function readBillDraft(key: string): Draft | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft;
    // Guard against a corrupted / older-shape blob.
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.type !== "string" ||
      !Array.isArray(parsed.items)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeBillDraft(key: string, draft: Draft): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Private mode, quota, or storage disabled — best effort, never throw
    // out of a render/effect.
  }
}

export function clearBillDraft(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}
