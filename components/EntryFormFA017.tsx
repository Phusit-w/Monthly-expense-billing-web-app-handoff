"use client";

import { useEffect, useRef, useState } from "react";
import { deleteSavedEmployee, rememberLastEmployee, saveEmployeeForReuse } from "@/actions/profile";
import ConfirmDialog from "@/components/ConfirmDialog";
import EntryEmployeeFields from "@/components/EntryEmployeeFields";
import SavedListManager from "@/components/SavedListManager";
import TravelRowCalculatorPanel from "@/components/TravelRowCalculatorPanel";
import { dmyFromISODate, todayISODate } from "@/lib/draft";
import { DEFAULT_ROWS_FA017, DEFAULT_ROWS_FA018, PAGE_ROWS, SHOW_PROJECT_FIELD } from "@/lib/constants";
import { num } from "@/lib/format";
import { fa017RowTotal } from "@/lib/totals";
import { emptyItemFA017, emptyItemFA018, isFA017ItemEmpty, padItems } from "@/lib/types";
import type {
  Draft,
  EmployeeSnapshot,
  FA017Item,
  FA018Item,
  ItemField,
  SavedEmployeeEntry,
  SavedItemEntry,
} from "@/lib/types";
import { entryDraftKey } from "@/lib/entryDraft";
import type { EntryDraftFA017 } from "@/lib/entryDraft";
import { pendingTravelEntryKey } from "@/lib/travelRates";
import type { PendingTravelEntry } from "@/lib/travelRates";
import { useSavedItems } from "@/lib/useSavedItems";

// Starts with PAGE_ROWS blank rows on screen (lib/constants.ts) — handleCreate
// below pads back up to DEFAULT_ROWS_FA017 before handing off to BillEditor,
// so the printed form still gets a full page's worth of rows.
function freshItems(): FA017Item[] {
  return Array.from({ length: PAGE_ROWS }, emptyItemFA017);
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

// AMOUNT_FIELDS' labels sit side-by-side in one flex row per item (see
// render below), but "Transport & Express way" and "Local Currency Amount"
// wrap onto 2 lines while the rest ("Gasoline", "Hotel", ...) fit on 1 —
// with only labelStyle's marginBottom under each, the wrapped labels push
// their input down further than the single-line ones, so the row of inputs
// no longer lines up. Reserving 2 lines' worth of height up front keeps
// every label in the row the same height regardless of wrap, so the inputs
// stay aligned.
const amountLabelStyle: React.CSSProperties = {
  ...labelStyle,
  minHeight: "2.6em",
  lineHeight: 1.3,
};

// Description of Expenses prints into a narrow, fixed-width table column
// (FA017Form.tsx) — a long description wraps onto several lines there and
// can push the whole printed form onto an extra A4 page even when the rest
// of the claim is short (confirmed: a 5-line description alone added ~130px
// to that row's printed height, enough by itself to overflow the page
// budget in lib/constants.ts). Purely advisory — not a hard cap — since
// there's no way from this roomy entry form to know how many other rows
// will end up sharing the page.
const LONG_DESC_LINE_THRESHOLD = 3;
function isDescriptionLong(desc: string): boolean {
  return desc.split("\n").length > LONG_DESC_LINE_THRESHOLD || desc.length > 180;
}

const AMOUNT_FIELDS: { key: keyof FA017Item; label: string }[] = [
  { key: "gasoline", label: "Gasoline" },
  { key: "hotel", label: "Hotel" },
  { key: "entertain", label: "Entertain" },
  { key: "mobile", label: "Mobile" },
  { key: "transport", label: "Transport & Express way" },
  { key: "other", label: "Other" },
  { key: "localAmt", label: "Local Currency Amount" },
];

// Roomy entry form for F-FA-017 (Employee Expense Claim). Same FA017Item
// shape as the compact print table (FA017Form.tsx) — just friendlier
// widgets: a native <input type="date"> per row (see EntryFormFA018's
// comment on why that round-trips into the compact form's splitDMY with no
// conversion needed), and each of the 7 expense categories as its own
// labeled amount field instead of a cramped ~45px-wide table column.
export default function EntryFormFA017({
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
  // Save/reuse individual expense rows by their Description text (see
  // lib/useSavedItems.ts) — savingRow/justSavedRow track per-row button
  // feedback the same way EntryEmployeeFields' single saving/justSaved pair
  // does, just keyed by absolute row index since any row can be saved.
  const {
    items: savedItemList,
    findMatch: findSavedItem,
    save: saveItemRow,
    remove: removeSavedItem,
  } = useSavedItems("FA017", savedItems);
  const [savingRow, setSavingRow] = useState<number | null>(null);
  const [justSavedRow, setJustSavedRow] = useState<number | null>(null);
  // Index of the row awaiting "ยืนยันการบันทึก" confirmation — separate from
  // savingRow (which only tracks an in-flight save, after confirmation).
  // saveItemForReuse (actions/savedItems.ts) upserts keyed by Description,
  // so re-saving an existing one silently overwrites it; the confirm step
  // gives a last chance to catch that.
  const [pendingSaveRow, setPendingSaveRow] = useState<number | null>(null);
  const [items, setItems] = useState<FA017Item[]>(freshItems);
  // "DATE :" — feeds FA017Form's own DATE: field (top-right of the info
  // table) once handed off to BillEditor. Defaults to today, same as this
  // form always did before this field existed, but is now user-editable
  // rather than fixed at whatever moment "สร้างฟอร์ม" is clicked (e.g. filing
  // a claim a few days after the fact). A native <input type="date"> (per
  // request) — see its lang="en-GB" below for why dd/mm/yyyy display
  // doesn't need a custom widget, and dmyFromISODate (lib/draft.ts) for the
  // Gregorian→Buddhist-era conversion its "yyyy-mm-dd" value still needs.
  const [dateISO, setDateISO] = useState(todayISODate());

  // Flips true once the restore effect below has run — gates the save
  // effect further down so it never fires with this render's still-default
  // (pre-restore) state in its closure. Must be real state, not a ref: a
  // ref would be visible to a same-commit save effect immediately, but
  // that effect's closure over employee/items/etc. would still be stale
  // (queued updates from other mount effects haven't landed in a render
  // yet) — using state instead means the save effect's own closure only
  // ever sees restored === true once a render carrying the fully-restored
  // values has actually happened.
  const [restored, setRestored] = useState(false);

  // Guards the restore effect below against React Strict Mode's dev-only
  // double-invoke of mount effects (render → run effects → simulate
  // unmount/cleanup → run effects again, all before the browser paints).
  // Without this, the second invocation re-reads entryDraftKey("FA017")
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

  // Restores this form's own in-progress state (employee, items, DATE)
  // after a real route change away from /bill/entry/fa017 and back — e.g.
  // Header's "คำนวณค่าเดินทาง" → TravelCalculator's "ส่งไปฟอร์ม", which fully
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
  // Parsed data is always spread OVER known-good defaults (emptyItemFA017,
  // the current employee state) rather than trusted wholesale — a stale
  // draft left in someone's browser tab from before an EmployeeSnapshot/
  // FA017Item shape change shouldn't be able to inject unexpected fields.
  useEffect(() => {
    setRestored(true);
    if (restoreAppliedRef.current) return;
    restoreAppliedRef.current = true;
    const raw = sessionStorage.getItem(entryDraftKey("FA017"));
    if (!raw) return;
    let draft: EntryDraftFA017 | null;
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
      setItems(draft.items.map((it) => ({ ...emptyItemFA017(), ...it })));
    }
    if (typeof draft.dateISO === "string" && draft.dateISO) setDateISO(draft.dateISO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handoff from TravelCalculator ("ส่งไปฟอร์ม FA017") — see
  // EntryFormFA018.tsx's identical effect for the full rationale. "Transport
  // & Express way" gets filled with the calculated travel cost, and
  // Description of Expenses gets the "เดินทางไป <destination>" label when the
  // amount came from a named fixed destination (see PendingTravelEntry's
  // comment in lib/travelRates.ts; blank for a taxi-meter estimate, same as
  // before). Everything else on the row is left blank for the user to fill
  // in themselves — Date included (TravelCalculator has no date field of
  // its own, so defaulting it to today would be a guess, not a fact carried
  // over from that page), Receipt (dropdown only has "" / "Y" / "N", no "no
  // receipt"/N/A option to pick), Project/CC, and every other amount field.
  // "Local Currency Amount" specifically: re-checked against
  // lib/totals.ts's fa017RowTotal, which still sums gasoline+hotel+
  // entertain+mobile+transport+other+localAmt as independent fields — it
  // is not derived from Transport & Express way (or vice versa), so
  // filling both here would double-count the trip into the row's total.
  useEffect(() => {
    const key = pendingTravelEntryKey("FA017");
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    sessionStorage.removeItem(key);
    let entry: PendingTravelEntry;
    try {
      entry = JSON.parse(raw);
    } catch {
      return;
    }
    const filledRow: FA017Item = {
      ...emptyItemFA017(),
      desc: entry.desc ?? "",
      transport: entry.amount.toFixed(2),
    };
    setItems((its) => {
      const idx = its.findIndex(isFA017ItemEmpty);
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
  // default instead of leaving a stale all-blank draft sitting in
  // sessionStorage. No debounce: this is a cheap local JSON.stringify +
  // sessionStorage.setItem on a handful of rows, not a network round-trip
  // like the DB-backed saves elsewhere in this app.
  useEffect(() => {
    if (!restored) return;
    const key = entryDraftKey("FA017");
    if (isFormPristine()) {
      sessionStorage.removeItem(key);
      return;
    }
    sessionStorage.setItem(
      key,
      JSON.stringify({ employee, items, dateISO } satisfies EntryDraftFA017)
    );
    // isFormPristine is intentionally omitted: it's a fresh function every
    // render but only ever reads employee/items/dateISO, which are already
    // listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, employee, items, dateISO]);

  // Reused by the save effect above (to prune a drained draft) and by the
  // "เริ่มกรอกใหม่" button's visibility (no point offering to clear a form
  // that already has nothing in it). dateISO is compared against
  // todayISODate() fresh each render rather than a value pinned at mount —
  // accepted edge case: a tab left open across midnight without a reload
  // can make this go false with nothing actually touched, showing the
  // button when technically nothing needs clearing. Cosmetic only, not
  // worth pinning "today" to mount time to avoid.
  function isFormPristine(): boolean {
    return (
      JSON.stringify(employee) === JSON.stringify(profile) &&
      items.every(isFA017ItemEmpty) &&
      dateISO === todayISODate()
    );
  }

  // "เริ่มกรอกใหม่" — discards any restored/in-progress draft and resets
  // every field back to the same defaults the initial useState calls use.
  function startOver() {
    if (typeof window !== "undefined" && !window.confirm(
      "เริ่มกรอกข้อมูลใหม่ทั้งหมดใช่หรือไม่? ข้อมูลที่กรอกไว้ในฟอร์มนี้จะถูกลบทั้งหมด"
    )) {
      return;
    }
    sessionStorage.removeItem(entryDraftKey("FA017"));
    setEmployee(profile);
    setItems(freshItems());
    setDateISO(todayISODate());
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

  function updateItem(i: number, field: ItemField, value: string) {
    setItems((its) => {
      const next = its.slice();
      next[i] = { ...next[i], [field]: value } as FA017Item;
      return next;
    });
  }

  // No row cap — the handed-off Draft's FA017Form/FA018Form paginate onto
  // additional A4 pages automatically once content overflows one (see
  // lib/pagination.ts), so there's no "fits on one page" ceiling to enforce
  // this early either.
  function addRow() {
    setItems((its) => [...its, emptyItemFA017()]);
  }

  function removeLastRow() {
    setItems((its) => (its.length <= 1 ? its : its.slice(0, -1)));
  }

  function clearRow(i: number) {
    setItems((its) => {
      const next = its.slice();
      next[i] = emptyItemFA017();
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
    sessionStorage.removeItem(entryDraftKey("FA017"));
    const draft: Draft = {
      id: null,
      updatedAt: null,
      type: "FA017",
      ...dmyFromISODate(dateISO),
      employee,
      remark: "",
      items: padItems(items, DEFAULT_ROWS_FA017, emptyItemFA017),
    };
    onCreate(draft);
  }

  // "สร้างฟอร์มใบรับรองแทนใบเสร็จ →" — hands the same rows off to an FA018 draft instead,
  // carrying over วันที่ → วันที่, Description of Expenses → รายการ, and a
  // row's amount → จำนวนเงิน. Everything FA018 has no equivalent for
  // (Receipt, Project/CC) is dropped; เลขที่โครงการ is left blank same as a
  // fresh FA018 row. DATE: does carry over even though FA018Form has no
  // visible field for it (see this file's "DATE :" state comment) — the
  // Draft still stores monthName/monthYear, which RecordsTable's history
  // view groups by, so the date the user actually picked here should win
  // over silently defaulting to today.
  //
  // amount uses fa017RowTotal (every category column summed: Gasoline,
  // Hotel, Entertain, Mobile, Transport & Express way, Other, and Local
  // Currency Amount), not just localAmt — people commonly put a row's
  // amount under Transport & Express way, Gasoline, etc. instead of
  // specifically "Local Currency Amount", and an amount-only-from-localAmt
  // mapping silently dropped those, handing off a FA018 row with a
  // description but a blank/zero amount.
  //
  // Same onCreate the FA017 handleCreate above uses (not a new tab — that
  // was tried and reverted per request: window.open + sessionStorage was
  // one more moving part than this needed, and complicated "ย้อนกลับ" for
  // no real benefit). EntryFlow.tsx renders this same EntryFormFA017
  // instance underneath whichever draft is active, so passing a FA018-typed
  // draft to the same onCreate still works (BillEditor picks its form from
  // draft.type, not from which page it's on) — and its "ย้อนกลับ" un-hiding
  // *this* entry form (rather than /bill/entry/fa018) is exactly the
  // "go back to FA017" behavior wanted here, for free.
  function handleCreateFA018() {
    // Still "leaving the FA017 entry form" (per this function's own doc
    // comment above) — clear FA017's own draft key, same as handleCreate.
    // FA018's key is untouched; this handoff never went through
    // EntryFormFA018 at all.
    sessionStorage.removeItem(entryDraftKey("FA017"));
    const draft: Draft = {
      id: null,
      updatedAt: null,
      type: "FA018",
      ...dmyFromISODate(dateISO),
      employee,
      remark: "",
      items: padItems(
        items.map((it): FA018Item => {
          const total = fa017RowTotal(it);
          return {
            date: it.date,
            desc: it.desc,
            projectNo: "",
            amount: total ? total.toFixed(2) : "",
          };
        }),
        DEFAULT_ROWS_FA018,
        emptyItemFA018
      ),
    };
    onCreate(draft);
  }

  // Same clear-on-focus-if-zero / snap-to-2-decimals-on-blur behavior
  // FA017Form.tsx's amountFieldProps already uses, kept local here (not
  // extracted to lib/format.ts) since FA017Form's own copy is likewise
  // component-local.
  function amountFieldProps(i: number, field: keyof FA017Item, value: string) {
    return {
      type: "number" as const,
      step: "0.01",
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => updateItem(i, field, e.target.value),
      onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
        if (e.target.value !== "" && num(e.target.value) === 0) updateItem(i, field, "");
      },
      onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
        if (e.target.value !== "") updateItem(i, field, num(e.target.value).toFixed(2));
      },
      style: inputStyle,
    };
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>กรอกข้อมูล Expense Claim</div>
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

      {/* Feeds FA017Form's own "DATE :" field (top-right of the info table)
          once handed off to BillEditor — see the dateISO state's comment.
          Displays mm/dd/yyyy (or whatever order/locale) per the visitor's
          own Chrome language setting — tried lang="en-GB" to force
          dd/mm/yyyy, but confirmed in this environment that Chrome's native
          date-input segment order follows the browser's own
          chrome://settings/languages, not a page-level lang attribute (this
          used to work; Chrome no longer honors it). Per request, left as
          the browser's default rather than replacing the calendar picker
          with a custom widget. dmyFromISODate (lib/draft.ts) still converts
          the "yyyy-mm-dd" value's Gregorian year to Buddhist era for the
          Draft regardless of how the picker displays it. */}
      <div style={{ background: "#fff", border: "1px solid #d8d5cc", borderRadius: 8, padding: "18px 22px", fontSize: 13 }}>
        <div style={{ maxWidth: 200 }}>
          <label style={labelStyle}>DATE :</label>
          <input
            type="date"
            value={dateISO}
            onChange={(e) => setDateISO(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

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
                fontSize: 13,
              }}
            >
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
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
                  <label style={labelStyle}>Description of Expenses</label>
                  {/* Auto-growing textarea (not a single-line <input>) so
                      text that's too long for the box — or that the user
                      hard-wraps with Enter — grows the box downward instead
                      of scrolling off sideways, same fix FA017Form.tsx's
                      compact print table already applies to this same
                      field. The ref re-measures scrollHeight on every render
                      (mount and each keystroke, since this inline
                      callback's identity changes every render), pinning the
                      textarea's own height to it. */}
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
                      // A saved row's Description was typed or picked from
                      // the picker below — fill in the rest of that row's
                      // saved fields too (see lib/useSavedItems.ts), same
                      // mechanism EntryEmployeeFields already uses for
                      // saved employee names.
                      const saved = findSavedItem(value);
                      if (saved) {
                        Object.entries(saved.data).forEach(([field, fieldValue]) =>
                          updateItem(i, field as ItemField, fieldValue)
                        );
                      }
                    }}
                    rows={1}
                    style={{ ...inputStyle, resize: "none", overflow: "hidden", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.4 }}
                  />
                  {isDescriptionLong(it.desc) && (
                    <div style={{ marginTop: 4, fontSize: 11, color: "#9a6700" }}>
                      รายละเอียดยาวมาก อาจทำให้พิมพ์ออกมาเกิน 1 หน้ากระดาษ แนะนำให้สรุปให้สั้นลง
                    </div>
                  )}
                  {/* Picks a saved Description by exact text — a plain
                      <input list=…>/<datalist> pair (used everywhere else
                      for this "type or pick a saved key" interaction) isn't
                      an option here since HTML's `list` attribute only works
                      on <input>, not <textarea> (needed above for
                      auto-growing Description). Same substitution
                      FA017Form.tsx's compact print table already makes for
                      this same constraint. Value always resets back to ""
                      right after a pick so this stays a reusable trigger
                      rather than displaying whatever was last chosen. */}
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
                            updateItem(i, field as ItemField, fieldValue)
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
                    title="บันทึกรายการนี้ไว้ใช้ซ้ำ พิมพ์/เลือก Description เดิมในแถวอื่นแล้วช่องที่เหลือจะเติมให้อัตโนมัติ"
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
                      updateItem(i, "transport", amount.toFixed(2));
                      if (desc && !it.desc.trim()) updateItem(i, "desc", desc);
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 110 }}>
                  <label style={labelStyle}>Receipt</label>
                  <select
                    value={it.receipt}
                    onChange={(e) => updateItem(i, "receipt", e.target.value)}
                    style={inputStyle}
                  >
                    <option value=""></option>
                    <option value="Y">Yes</option>
                    <option value="N">No</option>
                  </select>
                </div>
                {SHOW_PROJECT_FIELD && (
                  <div style={{ flex: 1, minWidth: 110 }}>
                    <label style={labelStyle}>Project / CC</label>
                    <input
                      value={it.projectCC}
                      onChange={(e) => updateItem(i, "projectCC", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {AMOUNT_FIELDS.map((f) => (
                  <div key={f.key} style={{ flex: 1, minWidth: 110 }}>
                    <label style={amountLabelStyle}>{f.label}</label>
                    <input {...amountFieldProps(i, f.key, it[f.key])} />
                  </div>
                ))}
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

      <div style={{ display: "flex", gap: 10, alignSelf: "flex-end" }}>
        <button
          onClick={handleCreateFA018}
          title="สร้างฟอร์มใบรับรองแทนใบเสร็จจากรายการชุดนี้ (วันที่, Description of Expenses, Local Currency Amount)"
          style={{
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
          สร้างฟอร์มใบรับรองแทนใบเสร็จ →
        </button>
        <button
          onClick={handleCreate}
          style={{
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
          สร้างฟอร์ม Expense Claim →
        </button>
      </div>
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
