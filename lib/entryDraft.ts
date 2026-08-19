import type { EmployeeSnapshot, FA017Item, FA018Item, RecordType } from "@/lib/types";

// Session-scoped persistence of the roomy entry form's own in-progress state
// (EntryFormFA017.tsx / EntryFormFA018.tsx), so a real route change away
// from /bill/entry/[type] and back (e.g. Header's "คำนวณค่าเดินทาง" →
// TravelCalculator's "ส่งไปฟอร์ม") doesn't discard what the user already
// typed — that navigation fully unmounts/remounts the entry form, unlike
// EntryFlow's same-tree swap into BillEditor (see EntryFlow.tsx's comment),
// which needs no rescue like this.
//
// Same sessionStorage + typed-key-builder + try/catch-JSON.parse shape as
// lib/travelRates.ts's PendingTravelEntry, but a different kind of payload:
// PendingTravelEntry is a one-shot handoff *into* this page (read once, then
// removed); this is the form's OWN state, continuously re-saved on every
// change and only cleared when the user actually leaves the form for good
// ("สร้างฟอร์ม") or explicitly starts over ("เริ่มกรอกใหม่").
//
// savedEmployeeList/savedItemList (server-sourced reference data shown in
// pickers) are deliberately not part of either shape below — only what the
// user actually typed into this specific claim.
export interface EntryDraftFA018 {
  employee: EmployeeSnapshot;
  items: FA018Item[];
}

export interface EntryDraftFA017 {
  employee: EmployeeSnapshot;
  items: FA017Item[];
  dateISO: string;
}

export function entryDraftKey(type: RecordType): string {
  return `entryDraft:${type}`;
}
