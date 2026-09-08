"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { deleteSavedEmployee, rememberLastEmployee, saveEmployeeForReuse } from "@/actions/profile";
import CollapsibleEntryRow from "@/components/CollapsibleEntryRow";
import ConfirmDialog from "@/components/ConfirmDialog";
import SavedItemPicker from "@/components/SavedItemPicker";
import EntryEmployeeFields from "@/components/EntryEmployeeFields";
import SavedListManager from "@/components/SavedListManager";
import TravelRowCalculatorPanel from "@/components/TravelRowCalculatorPanel";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { dmyFromISODate, todayISODate } from "@/lib/draft";
import { DEFAULT_ROWS_FA017, PAGE_ROWS, SHOW_PROJECT_FIELD } from "@/lib/constants";
import { fmt, num } from "@/lib/format";
import { fa017RowTotal } from "@/lib/totals";
import { emptyItemFA017, isFA017ItemEmpty, padItems } from "@/lib/types";
import type {
  Draft,
  EmployeeSnapshot,
  FA017Item,
  ItemField,
  SavedEmployeeEntry,
  SavedItemEntry,
} from "@/lib/types";
import { entryDraftKey } from "@/lib/entryDraft";
import type { EntryDraftFA017 } from "@/lib/entryDraft";
import { armNavGuard, disarmNavGuard } from "@/lib/navGuard";
import { pendingTravelEntryKey } from "@/lib/travelRates";
import type { PendingTravelEntry } from "@/lib/travelRates";
import { useSavedItems } from "@/lib/useSavedItems";

// Starts with PAGE_ROWS blank rows on screen (lib/constants.ts) — handleCreate
// below pads back up to DEFAULT_ROWS_FA017 before handing off to BillEditor,
// so the printed form still gets a full page's worth of rows.
function freshItems(): FA017Item[] {
  return Array.from({ length: PAGE_ROWS }, emptyItemFA017);
}

const inputClass =
  "w-full rounded-field border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none " +
  "transition-[border-color,box-shadow] duration-150 " +
  "focus:border-ink focus:shadow-[0_0_0_3px_var(--ring-focus)]";

const labelClass = "mb-1.5 block text-[13px] font-medium text-label";

// "Transport & Express way" and "Local Currency Amount" wrap onto 2 lines
// while the rest fit on 1; reserving 2 lines' worth of height (min-h-[2.6em])
// keeps every label in the amounts row the same height so the inputs align.
const amountLabelClass = `${labelClass} min-h-[2.6em] leading-tight`;

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
  // Which expense-line cards are collapsed (by row index). Add/remove-row
  // only touch the end of the list, so index keys stay stable enough; a
  // stale entry for a since-removed index is harmless.
  const [collapsedRows, setCollapsedRows] = useState<Set<number>>(() => new Set());
  function toggleRow(i: number) {
    setCollapsedRows((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }
  const allRowsCollapsed = items.length > 0 && items.every((_, i) => collapsedRows.has(i));
  function toggleAllRows() {
    setCollapsedRows(allRowsCollapsed ? new Set() : new Set(items.map((_, i) => i)));
  }
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
    // Flips a readiness flag once the sessionStorage read below (a real side
    // effect, not derivable at render time) has had its one chance to run.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    // One-time mount handoff from the travel calculator (sessionStorage read
    // above), not something derivable at render time.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems((its) => {
      const idx = its.findIndex(isFA017ItemEmpty);
      if (idx === -1) return [...its, filledRow];
      const next = its.slice();
      next[idx] = filledRow;
      return next;
    });
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

  // Prompt (via the shared app-shell guard, lib/navGuard.ts) before the
  // sidebar links or the browser Back button drop anything typed in here.
  // Same pristine gate as the autosave above.
  const guardToken = useId();
  const pathname = usePathname();
  useEffect(() => {
    if (isFormPristine()) disarmNavGuard(guardToken);
    else armNavGuard(guardToken, pathname);
    return () => disarmNavGuard(guardToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee, items, dateISO, guardToken, pathname]);

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
    setCollapsedRows(new Set());
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
      className: inputClass,
    };
  }

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h1 className="font-display text-[28px] font-bold leading-tight">
          กรอกข้อมูล Expense Claim
        </h1>
        {!isFormPristine() && (
          <Button
            variant="danger"
            size="sm"
            onClick={startOver}
            title="ล้างข้อมูลที่กรอกไว้ทั้งหมดในฟอร์มนี้ แล้วเริ่มกรอกใหม่"
          >
            เริ่มกรอกใหม่
          </Button>
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
      <Card className="p-6 text-[13px]">
        <div className="max-w-[200px]">
          <label className={labelClass}>DATE :</label>
          <input
            type="date"
            value={dateISO}
            onChange={(e) => setDateISO(e.target.value)}
            className={inputClass}
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-6">
        <div className="text-base font-medium">รายการค่าใช้จ่าย</div>
        <div className="flex flex-col gap-3">
          {items.map((it, i) => (
            <CollapsibleEntryRow
              key={i}
              index={i}
              collapsed={collapsedRows.has(i)}
              onToggle={() => toggleRow(i)}
              summary={
                it.desc.trim() || (
                  <span className="italic text-muted">ยังไม่ได้กรอกรายละเอียด</span>
                )
              }
              trailing={`รวม ${fmt(fa017RowTotal(it))}`}
            >
              <div className="mb-2.5 flex flex-wrap gap-3">
                <div className="min-w-[150px] flex-1">
                  <label className={labelClass}>วันที่</label>
                  <input
                    type="date"
                    value={it.date}
                    onChange={(e) => updateItem(i, "date", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="min-w-[220px] flex-[3]">
                  <label className={labelClass}>Description of Expenses</label>
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
                    className={`${inputClass} resize-none overflow-hidden leading-relaxed whitespace-pre-wrap break-words`}
                  />
                  {isDescriptionLong(it.desc) && (
                    <div className="mt-1 text-[11px] text-accent">
                      รายละเอียดยาวมาก อาจทำให้พิมพ์ออกมาเกิน 1 หน้ากระดาษ แนะนำให้สรุปให้สั้นลง
                    </div>
                  )}
                  {/* A separate type-to-search trigger for picking a saved
                      Description (SavedItemPicker: <input list>/<datalist>) —
                      the Description field itself above is a <textarea> for
                      auto-growing, and HTML's `list` attribute only works on
                      <input>, so it can't host the datalist directly.
                      Picking one fills this row's other fields from the
                      match and clears itself. */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <SavedItemPicker
                      savedItems={savedItemList}
                      onPick={(desc) => {
                        updateItem(i, "desc", desc);
                        const saved = findSavedItem(desc);
                        if (saved) {
                          Object.entries(saved.data).forEach(([field, fieldValue]) =>
                            updateItem(i, field as ItemField, fieldValue)
                          );
                        }
                      }}
                      className="max-w-full rounded-chip border border-dashed border-line bg-surface px-3 py-1.5 text-[11px] text-label outline-none focus:border-ink"
                    />
                    <button
                      type="button"
                      onClick={() => setPendingSaveRow(i)}
                      disabled={savingRow === i || !it.desc.trim()}
                      title="บันทึกรายการนี้ไว้ใช้ซ้ำ พิมพ์/เลือก Description เดิมในแถวอื่นแล้วช่องที่เหลือจะเติมให้อัตโนมัติ"
                      className="ui-btn rounded-chip border border-dashed border-ink px-3 py-1.5 text-[11px] font-medium text-ink transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingRow === i
                        ? "กำลังบันทึก…"
                        : justSavedRow === i
                          ? "บันทึกแล้ว ✓"
                          : "บันทึกไว้ใช้ซ้ำ"}
                    </button>
                    <Button
                      variant="danger"
                      size="sm"
                      className="!h-7 !px-3 !text-[11px]"
                      onClick={() => clearRow(i)}
                      title="ล้างข้อมูลเฉพาะแถวนี้ โดยไม่ลบรายการที่บันทึกไว้"
                    >
                      ล้างข้อมูลแถวนี้
                    </Button>
                    <TravelRowCalculatorPanel
                      onApply={(amount, desc) => {
                        updateItem(i, "transport", amount.toFixed(2));
                        if (desc && !it.desc.trim()) updateItem(i, "desc", desc);
                      }}
                    />
                  </div>
                </div>
                <div className="min-w-[110px] flex-1">
                  <label className={labelClass}>Receipt</label>
                  <select
                    value={it.receipt}
                    onChange={(e) => updateItem(i, "receipt", e.target.value)}
                    className={inputClass}
                  >
                    <option value=""></option>
                    <option value="Y">Yes</option>
                    <option value="N">No</option>
                  </select>
                </div>
                {SHOW_PROJECT_FIELD && (
                  <div className="min-w-[110px] flex-1">
                    <label className={labelClass}>Project / CC</label>
                    <input
                      value={it.projectCC}
                      onChange={(e) => updateItem(i, "projectCC", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {AMOUNT_FIELDS.map((f) => (
                  <div key={f.key} className="min-w-[110px] flex-1">
                    <label className={amountLabelClass}>{f.label}</label>
                    <input {...amountFieldProps(i, f.key, it[f.key])} />
                  </div>
                ))}
              </div>
            </CollapsibleEntryRow>
          ))}
        </div>

        <SavedListManager
          label="รายการที่บันทึกไว้"
          items={savedItemList.map((entry) => ({ id: entry.id, text: entry.desc }))}
          onDelete={removeSavedItem}
        />

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={addRow}>
            + เพิ่มรายการ
          </Button>
          <Button variant="danger" size="sm" onClick={removeLastRow}>
            − ลบรายการ
          </Button>
          {items.length > 1 && (
            <Button variant="outline" size="sm" onClick={toggleAllRows}>
              {allRowsCollapsed ? "ขยายทุกรายการ" : "ย่อทุกรายการ"}
            </Button>
          )}
        </div>
      </Card>

      <div className="flex flex-wrap justify-end gap-2.5">
        <Button variant="primary" onClick={handleCreate}>
          สร้างฟอร์ม Expense Claim →
        </Button>
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
