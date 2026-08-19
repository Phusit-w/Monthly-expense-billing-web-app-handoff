"use client";

import { useEffect, useRef, useState } from "react";
import { deleteSavedEmployee, rememberLastEmployee, saveEmployeeForReuse } from "@/actions/profile";
import ConfirmDialog from "@/components/ConfirmDialog";
import EntryEmployeeFields from "@/components/EntryEmployeeFields";
import SavedListManager from "@/components/SavedListManager";
import TravelRowCalculatorPanel from "@/components/TravelRowCalculatorPanel";
import { currentDMY } from "@/lib/draft";
import { DEFAULT_ROWS_FA018, PAGE_ROWS } from "@/lib/constants";
import { emptyItemFA018, isFA018ItemEmpty, padItems } from "@/lib/types";
import type { Draft, EmployeeSnapshot, FA018Item, SavedEmployeeEntry, SavedItemEntry } from "@/lib/types";
import { entryDraftKey } from "@/lib/entryDraft";
import type { EntryDraftFA018 } from "@/lib/entryDraft";
import { pendingTravelEntryKey } from "@/lib/travelRates";
import type { PendingTravelEntry } from "@/lib/travelRates";
import { useSavedItems } from "@/lib/useSavedItems";

// Starts with PAGE_ROWS blank rows on screen (lib/constants.ts) — handleCreate
// below pads back up to DEFAULT_ROWS_FA018 before handing off to BillEditor,
// so the printed form still gets a full page's worth of rows.
function freshItems(): FA018Item[] {
  return Array.from({ length: PAGE_ROWS }, emptyItemFA018);
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px 8px",
  border: "1px solid #ccc",
  borderRadius: 4,
  font: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "#555",
  marginBottom: 4,
};

// Roomy entry form for F-FA-018 (รายงานค่าใช้จ่ายไม่มีบิล). Same FA018Item
// shape as the compact print table (FA018Form.tsx) — just friendlier
// widgets. Notably a native <input type="date"> per row instead of the
// compact form's cramped day/month/year triple: lib/format.ts's splitDMY
// already parses ISO "yyyy-mm-dd" strings (kept for backward compat with
// FA018's old native date input, before it was replaced — see FA018Form.tsx
// and lib/format.ts's comment), so this value round-trips into FA018Form's
// per-row date column with zero extra conversion code.
export default function EntryFormFA018({
  profile,
  savedEmployees,
  savedItems,
  onCreate,
}: {
  profile: EmployeeSnapshot;
  savedEmployees: SavedEmployeeEntry[];
  savedItems: SavedItemEntry[];
  onCreate: (draft: Draft) => void;
}) {
  const [employee, setEmployee] = useState<EmployeeSnapshot>(profile);
  // Local optimistic copy of savedEmployees, same rationale as
  // lib/useSavedItems.ts's own copy — a save/delete here is reflected in
  // this row's own datalist immediately, without waiting on a page reload.
  const [savedEmployeeList, setSavedEmployeeList] = useState<SavedEmployeeEntry[]>(savedEmployees);
  // Save/reuse individual expense rows by their รายการ text (see
  // lib/useSavedItems.ts) — savingRow/justSavedRow track per-row button
  // feedback the same way EntryEmployeeFields' single saving/justSaved pair
  // does, just keyed by absolute row index since any row can be saved.
  const {
    items: savedItemList,
    findMatch: findSavedItem,
    save: saveItemRow,
    remove: removeSavedItem,
  } = useSavedItems("FA018", savedItems);
  const [savingRow, setSavingRow] = useState<number | null>(null);
  const [justSavedRow, setJustSavedRow] = useState<number | null>(null);
  // Index of the row awaiting "ยืนยันการบันทึก" confirmation — see
  // EntryFormFA017.tsx's identical field for the full rationale.
  const [pendingSaveRow, setPendingSaveRow] = useState<number | null>(null);
  const [items, setItems] = useState<FA018Item[]>(freshItems);
  // Flips true once the restore effect below has run — gates the save
  // effect further down so it never fires with this render's still-default
  // (pre-restore) employee/items in its closure. Must be real state, not a
  // ref: a ref would be visible to a same-commit save effect immediately,
  // but that effect's closure over employee/items would still be stale
  // (queued updates from other mount effects haven't landed in a render
  // yet) — using state instead means the save effect's own closure only
  // ever sees restored === true once a render carrying the fully-restored
  // values has actually happened.
  const [restored, setRestored] = useState(false);

  // Guards the restore effect below against React Strict Mode's dev-only
  // double-invoke of mount effects (render → run effects → simulate
  // unmount/cleanup → run effects again, all before the browser paints).
  // Without this, the second invocation re-reads entryDraftKey("FA018")
  // (unchanged — this effect never deletes that key, unlike the
  // travel-handoff effect below which self-guards by deleting its key on
  // first read) and calls the *plain* setItems(draft.items...) below again,
  // clobbering whatever the travel-handoff effect's setItems already folded
  // in during the first pass — which is exactly the bug where "ส่งค่านี้ไปที่
  // ฟอร์ม" silently loses both the new travel row and, depending on timing,
  // rows already typed. A ref (not state) survives Strict Mode's synthetic
  // remount because it's the same component instance throughout, so this
  // reliably makes the restore side effect run only once per real mount.
  const restoreAppliedRef = useRef(false);

  // Restores this form's own in-progress state (employee + items) after a
  // real route change away from /bill/entry/fa018 and back — e.g. Header's
  // "คำนวณค่าเดินทาง" → TravelCalculator's "ส่งไปฟอร์ม", which fully
  // unmounts/remounts this component, unlike EntryFlow's same-tree swap
  // into BillEditor (see EntryFlow.tsx's comment, which needs no rescue
  // like this). See lib/entryDraft.ts.
  //
  // Declared BEFORE the travel-handoff effect below on purpose: both fire
  // in the same passive-effect flush on mount, and setState calls are
  // folded in dispatch order at the next render — so as long as this one
  // dispatches first, the travel-handoff effect's functional setItems
  // update (finds the first blank row) folds over these just-restored
  // items rather than the mount-time defaults, in the same settling
  // render. That's what makes "fill part of a form → go compute a travel
  // cost → send back" land both the earlier-typed data and the new travel
  // row in one restored form.
  //
  // Parsed data is always spread OVER known-good defaults (emptyItemFA018,
  // the current employee state) rather than trusted wholesale — a stale
  // draft left in someone's browser tab from before an EmployeeSnapshot/
  // FA018Item shape change shouldn't be able to inject unexpected fields.
  useEffect(() => {
    setRestored(true);
    if (restoreAppliedRef.current) return;
    restoreAppliedRef.current = true;
    const raw = sessionStorage.getItem(entryDraftKey("FA018"));
    if (!raw) return;
    let draft: EntryDraftFA018 | null;
    try {
      const parsed = JSON.parse(raw);
      draft = parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      draft = null;
    }
    if (!draft) return;
    if (draft.employee && typeof draft.employee === "object") {
      setEmployee((e) => ({ ...e, ...draft!.employee }));
    }
    if (Array.isArray(draft.items) && draft.items.length > 0) {
      setItems(draft.items.map((it) => ({ ...emptyItemFA018(), ...it })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handoff from TravelCalculator ("ส่งไปฟอร์ม FA018"): fills the first
  // still-blank row (or appends one if every row already has something in
  // it) with the calculated travel cost — "จำนวนเงิน" (amount) always gets
  // filled, and "รายการ" gets the "เดินทางไป <destination>" label when the
  // amount came from a named fixed destination (see PendingTravelEntry's
  // comment in lib/travelRates.ts; empty string for a taxi-meter estimate,
  // same as before). "เลขที่โครงการ" and "วันที่" are both left blank for the
  // user to fill in themselves — the trip's actual date isn't something
  // TravelCalculator knows (it has no date field of its own), so defaulting
  // to today would be a guess, not a fact carried over from that page.
  // Never overwrites a row the user has already started filling in. Runs
  // once on mount only, and clears the key immediately so it isn't
  // reapplied on a later remount/revisit.
  useEffect(() => {
    const key = pendingTravelEntryKey("FA018");
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    sessionStorage.removeItem(key);
    let entry: PendingTravelEntry;
    try {
      entry = JSON.parse(raw);
    } catch {
      return;
    }
    const filledRow: FA018Item = {
      date: "",
      desc: entry.desc ?? "",
      projectNo: "",
      amount: entry.amount.toFixed(2),
    };
    setItems((its) => {
      const idx = its.findIndex(isFA018ItemEmpty);
      if (idx === -1) return [...its, filledRow];
      const next = its.slice();
      next[idx] = filledRow;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persists on every change so a subsequent unmount (real navigation away,
  // e.g. to /travel) doesn't lose it — see lib/entryDraft.ts and the
  // restore effect above. Gated on `restored` so this never fires with
  // pre-restore closure values (see that state's own comment above).
  // Prunes the key back to nothing once the form returns to its pristine
  // default (e.g. after "เริ่มกรอกใหม่" clears every field by hand rather
  // than via the dedicated button below) instead of leaving a stale
  // all-blank draft sitting in sessionStorage. No debounce: this is a
  // cheap local JSON.stringify + sessionStorage.setItem on a handful of
  // rows, not a network round-trip like the DB-backed saves elsewhere in
  // this app.
  useEffect(() => {
    if (!restored) return;
    const key = entryDraftKey("FA018");
    if (isFormPristine()) {
      sessionStorage.removeItem(key);
      return;
    }
    sessionStorage.setItem(key, JSON.stringify({ employee, items } satisfies EntryDraftFA018));
    // isFormPristine is intentionally omitted: it's a fresh function every
    // render but only ever reads employee/items, which are already listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, employee, items]);

  // Reused by the save effect above (to prune a drained draft) and by the
  // "เริ่มกรอกใหม่" button's visibility (no point offering to clear a form
  // that already has nothing in it).
  function isFormPristine(): boolean {
    return JSON.stringify(employee) === JSON.stringify(profile) && items.every(isFA018ItemEmpty);
  }

  // "เริ่มกรอกใหม่" — discards any restored/in-progress draft and resets
  // every field back to the same defaults the initial useState calls use.
  function startOver() {
    if (typeof window !== "undefined" && !window.confirm(
      "เริ่มกรอกข้อมูลใหม่ทั้งหมดใช่หรือไม่? ข้อมูลที่กรอกไว้ในฟอร์มนี้จะถูกลบทั้งหมด"
    )) {
      return;
    }
    sessionStorage.removeItem(entryDraftKey("FA018"));
    setEmployee(profile);
    setItems(freshItems());
    setSavingRow(null);
    setJustSavedRow(null);
  }

  function setEmpField(field: "name" | "position" | "department" | "employeeNo", value: string) {
    setEmployee((e) => ({ ...e, [field]: value }));
  }

  // Picking a saved name (EntryEmployeeFields' datalist) replaces the whole
  // snapshot, office included — office has no field of its own in this
  // roomy entry form, but it's still real data that differs per saved
  // person, same as the other four fields. `id` is dropped — `employee`
  // state is a plain EmployeeSnapshot (what ends up in the Draft), the id
  // only matters for the saved-list's own bookkeeping above. Also remembers
  // the pick as this browser's default for next visit (actions/profile.ts),
  // same as ProfileCard's identical datalist does.
  function selectSavedEmployee(saved: SavedEmployeeEntry) {
    const { id: _id, ...snapshot } = saved;
    setEmployee(snapshot);
    void rememberLastEmployee(saved.name);
  }

  async function saveEmployee() {
    const saved = await saveEmployeeForReuse(employee);
    if (!saved) return;
    setSavedEmployeeList((its) => {
      const next = its.filter((e) => e.name !== saved.name);
      next.push(saved);
      next.sort((a, b) => a.name.localeCompare(b.name, "th"));
      return next;
    });
  }

  async function removeSavedEmployeeEntry(id: string) {
    await deleteSavedEmployee(id);
    setSavedEmployeeList((its) => its.filter((e) => e.id !== id));
  }

  function updateItem(i: number, field: keyof FA018Item, value: string) {
    setItems((its) => {
      const next = its.slice();
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  }

  // No row cap — the handed-off Draft's FA017Form/FA018Form paginate onto
  // additional A4 pages automatically once content overflows one (see
  // lib/pagination.ts), so there's no "fits on one page" ceiling to enforce
  // this early either.
  function addRow() {
    setItems((its) => [...its, emptyItemFA018()]);
  }

  function removeLastRow() {
    setItems((its) => (its.length <= 1 ? its : its.slice(0, -1)));
  }

  function clearRow(i: number) {
    setItems((its) => {
      const next = its.slice();
      next[i] = emptyItemFA018();
      return next;
    });
  }

  async function confirmSaveRow() {
    const i = pendingSaveRow;
    if (i === null) return;
    setPendingSaveRow(null);
    setSavingRow(i);
    setJustSavedRow(null);
    await saveItemRow(items[i]);
    setSavingRow(null);
    setJustSavedRow(i);
    setTimeout(() => setJustSavedRow((r) => (r === i ? null : r)), 2000);
  }

  function handleCreate() {
    // From here on, the data lives in BillEditor's own state (EntryFlow
    // keeps this form mounted-but-hidden for that same-tree swap — see its
    // comment) — clear this form's own persisted draft so a later fresh
    // visit to this URL doesn't resurrect it.
    sessionStorage.removeItem(entryDraftKey("FA018"));
    const draft: Draft = {
      id: null,
      updatedAt: null,
      type: "FA018",
      ...currentDMY(),
      employee,
      remark: "",
      items: padItems(items, DEFAULT_ROWS_FA018, emptyItemFA018),
    };
    onCreate(draft);
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>กรอกข้อมูลใบรับรองแทนใบเสร็จ</div>
        {!isFormPristine() && (
          <button
            type="button"
            onClick={startOver}
            className="btn-danger"
            title="ล้างข้อมูลที่กรอกไว้ทั้งหมดในฟอร์มนี้ แล้วเริ่มกรอกใหม่"
            style={{
              padding: "6px 14px",
              border: "1px solid #b3261e",
              color: "#b3261e",
              borderRadius: 4,
              background: "#fff",
              font: "inherit",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            เริ่มกรอกใหม่
          </button>
        )}
      </div>

      <EntryEmployeeFields
        employee={employee}
        onChange={setEmpField}
        savedEmployees={savedEmployeeList}
        onSelectSaved={selectSavedEmployee}
        onSave={saveEmployee}
        onDeleteSaved={removeSavedEmployeeEntry}
      />

      <div style={{ background: "#fff", border: "1px solid #d8d5cc", borderRadius: 8, padding: "18px 22px" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>รายการค่าใช้จ่าย</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((it, i) => (
            <div
              key={i}
              style={{
                border: "1px solid #e3e0d8",
                borderRadius: 6,
                padding: "12px 14px",
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                fontSize: 13,
              }}
            >
              <div style={{ width: 42, fontWeight: 700, color: "#999", alignSelf: "center" }}>#{i + 1}</div>
              <div style={{ flex: 1, minWidth: 150 }}>
                <label style={labelStyle}>วันที่</label>
                <input
                  type="date"
                  value={it.date}
                  onChange={(e) => updateItem(i, "date", e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 3, minWidth: 220 }}>
                <label style={labelStyle}>รายการ</label>
                {/* Auto-growing textarea (not a single-line <input>) so text
                    that's too long for the box — or that the user hard-wraps
                    with Enter — grows the box downward instead of scrolling
                    off sideways, same fix FA018Form.tsx's compact print
                    table already applies to this same field. The ref
                    re-measures scrollHeight on every render (mount and each
                    keystroke, since this inline callback's identity changes
                    every render), pinning the textarea's own height to it. */}
                <textarea
                  ref={(el) => {
                    if (el) {
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }
                  }}
                  value={it.desc}
                  onChange={(e) => {
                    const value = e.target.value;
                    updateItem(i, "desc", value);
                    // A saved row's รายการ was typed or picked from the
                    // picker below — fill in the rest of that row's saved
                    // fields too (see lib/useSavedItems.ts), same mechanism
                    // EntryEmployeeFields already uses for saved employee
                    // names.
                    const saved = findSavedItem(value);
                    if (saved) {
                      Object.entries(saved.data).forEach(([field, fieldValue]) =>
                        updateItem(i, field as keyof FA018Item, fieldValue)
                      );
                    }
                  }}
                  rows={1}
                  style={{ ...inputStyle, resize: "none", overflow: "hidden", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.4 }}
                />
                {/* Picks a saved รายการ by exact text — a plain
                    <input list=…>/<datalist> pair (used everywhere else for
                    this "type or pick a saved key" interaction) isn't an
                    option here since HTML's `list` attribute only works on
                    <input>, not <textarea> (needed above for auto-growing
                    รายการ). Same substitution FA018Form.tsx's compact print
                    table already makes for this same constraint. Value
                    always resets back to "" right after a pick so this stays
                    a reusable trigger rather than displaying whatever was
                    last chosen. */}
                {savedItemList.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => {
                      const desc = e.target.value;
                      if (!desc) return;
                      updateItem(i, "desc", desc);
                      const saved = findSavedItem(desc);
                      if (saved) {
                        Object.entries(saved.data).forEach(([field, fieldValue]) =>
                          updateItem(i, field as keyof FA018Item, fieldValue)
                        );
                      }
                      e.target.value = "";
                    }}
                    title="เลือกรายการที่เคยบันทึกไว้"
                    style={{
                      marginTop: 6,
                      padding: "4px 8px",
                      border: "1px dashed #999",
                      borderRadius: 4,
                      background: "#fff",
                      font: "inherit",
                      fontSize: 11,
                      color: "#555",
                      cursor: "pointer",
                      maxWidth: "100%",
                    }}
                  >
                    <option value="">เลือกรายการที่บันทึกไว้…</option>
                    {savedItemList.map((entry) => (
                      <option key={entry.desc} value={entry.desc}>
                        {entry.desc}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => setPendingSaveRow(i)}
                  disabled={savingRow === i || !it.desc.trim()}
                  title="บันทึกรายการนี้ไว้ใช้ซ้ำ พิมพ์/เลือกรายการเดิมในแถวอื่นแล้วช่องที่เหลือจะเติมให้อัตโนมัติ"
                  style={{
                    marginTop: 6,
                    marginLeft: 6,
                    padding: "4px 8px",
                    border: "1px dashed #1c1c1c",
                    borderRadius: 4,
                    background: "#fff",
                    font: "inherit",
                    fontSize: 11,
                    color: "#1c1c1c",
                    cursor: savingRow === i || !it.desc.trim() ? "not-allowed" : "pointer",
                    opacity: savingRow === i || !it.desc.trim() ? 0.5 : 1,
                  }}
                >
                  {savingRow === i ? "กำลังบันทึก…" : justSavedRow === i ? "บันทึกแล้ว ✓" : "บันทึกไว้ใช้ซ้ำ"}
                </button>
                <button
                  type="button"
                  onClick={() => clearRow(i)}
                  className="btn-danger"
                  title="ล้างข้อมูลเฉพาะแถวนี้ โดยไม่ลบรายการที่บันทึกไว้"
                  style={{
                    marginTop: 6,
                    marginLeft: 6,
                    padding: "4px 8px",
                    border: "1px solid #b3261e",
                    borderRadius: 4,
                    background: "#fff",
                    font: "inherit",
                    fontSize: 11,
                    color: "#b3261e",
                    cursor: "pointer",
                  }}
                >
                  ล้างข้อมูลแถวนี้
                </button>
                <TravelRowCalculatorPanel
                  onApply={(amount, desc) => {
                    updateItem(i, "amount", amount.toFixed(2));
                    if (desc && !it.desc.trim()) updateItem(i, "desc", desc);
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={labelStyle}>เลขที่โครงการ</label>
                <input
                  value={it.projectNo}
                  onChange={(e) => updateItem(i, "projectNo", e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={labelStyle}>จำนวนเงิน</label>
                <input
                  type="number"
                  step="0.01"
                  value={it.amount}
                  onChange={(e) => updateItem(i, "amount", e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <SavedListManager
            label="รายการที่บันทึกไว้"
            items={savedItemList.map((entry) => ({ id: entry.id, text: entry.desc }))}
            onDelete={removeSavedItem}
          />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button
            onClick={addRow}
            style={{
              padding: "6px 14px",
              border: "1px dashed #1c1c1c",
              borderRadius: 4,
              background: "#fff",
              font: "inherit",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            + เพิ่มรายการ
          </button>
          <button
            onClick={removeLastRow}
            className="btn-danger"
            style={{
              padding: "6px 14px",
              border: "1px solid #b3261e",
              color: "#b3261e",
              borderRadius: 4,
              background: "#fff",
              font: "inherit",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            − ลบรายการ
          </button>
        </div>
      </div>

      <button
        onClick={handleCreate}
        style={{
          alignSelf: "flex-end",
          padding: "12px 28px",
          border: "1px solid #1c1c1c",
          background: "#fff",
          color: "#1c1c1c",
          borderRadius: 6,
          font: "inherit",
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        สร้างฟอร์ม →
      </button>
      <ConfirmDialog
        open={pendingSaveRow !== null}
        title="ยืนยันการบันทึกไว้ใช้ซ้ำ"
        message={
          pendingSaveRow !== null && findSavedItem(items[pendingSaveRow].desc)
            ? "มีรายการที่บันทึกไว้แล้วชื่อนี้อยู่ — บันทึกซ้ำจะเขียนทับข้อมูลเดิม ต้องการดำเนินการต่อหรือไม่?"
            : "บันทึกรายการนี้ไว้ใช้ซ้ำในครั้งหน้าหรือไม่?"
        }
        confirmLabel="บันทึก"
        busy={savingRow !== null}
        onConfirm={confirmSaveRow}
        onCancel={() => setPendingSaveRow(null)}
      />
    </div>
  );
}
