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
import { currentDMY } from "@/lib/draft";
import { fmt, num } from "@/lib/format";
import { DEFAULT_ROWS_FA018, PAGE_ROWS } from "@/lib/constants";
import { emptyItemFA018, isFA018ItemEmpty, padItems } from "@/lib/types";
import type { Draft, EmployeeSnapshot, FA018Item, SavedEmployeeEntry, SavedItemEntry } from "@/lib/types";
import { entryDraftKey } from "@/lib/entryDraft";
import type { EntryDraftFA018 } from "@/lib/entryDraft";
import { armNavGuard, disarmNavGuard } from "@/lib/navGuard";
import { pendingTravelEntryKey } from "@/lib/travelRates";
import type { PendingTravelEntry } from "@/lib/travelRates";
import { useSavedItems } from "@/lib/useSavedItems";

// Starts with PAGE_ROWS blank rows on screen (lib/constants.ts) — handleCreate
// below pads back up to DEFAULT_ROWS_FA018 before handing off to BillEditor,
// so the printed form still gets a full page's worth of rows.
function freshItems(): FA018Item[] {
  return Array.from({ length: PAGE_ROWS }, emptyItemFA018);
}

const inputClass =
  "w-full rounded-field border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none " +
  "transition-[border-color,box-shadow] duration-150 " +
  "focus:border-ink focus:shadow-[0_0_0_3px_var(--ring-focus)]";

const labelClass = "mb-1.5 block text-[13px] font-medium text-label";

// Roomy entry form for F-FA-018 (รายงานค่าใช้จ่ายไม่มีบิล). Same FA018Item
// shape as the compact print table (FA018Form.tsx) — just friendlier
// widgets. Native <input type="date"> per row; lib/format.ts's splitDMY
// parses the ISO value straight into FA018Form's per-row date column.
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
  const [savedEmployeeList, setSavedEmployeeList] = useState<SavedEmployeeEntry[]>(savedEmployees);
  const {
    items: savedItemList,
    findMatch: findSavedItem,
    save: saveItemRow,
    remove: removeSavedItem,
  } = useSavedItems("FA018", savedItems);
  const [savingRow, setSavingRow] = useState<number | null>(null);
  const [justSavedRow, setJustSavedRow] = useState<number | null>(null);
  const [pendingSaveRow, setPendingSaveRow] = useState<number | null>(null);
  const [items, setItems] = useState<FA018Item[]>(freshItems);
  // Which expense-line cards are collapsed (by row index) — see
  // CollapsibleEntryRow. Add/remove-row only touch the list's end.
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
  const [restored, setRestored] = useState(false);
  const restoreAppliedRef = useRef(false);

  // Restores this form's own in-progress state (employee + items) after a
  // real route change away and back (e.g. via the travel calculator). See
  // lib/entryDraft.ts and EntryFormFA017.tsx's identical block for the full
  // ordering rationale.
  useEffect(() => {
    // Flips a readiness flag once the sessionStorage read below (a real side
    // effect, not derivable at render time) has had its one chance to run.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  }, []);

  // Handoff from TravelCalculator ("ส่งไปฟอร์ม FA018"): fills the first
  // still-blank row (or appends one) with the calculated travel cost. Never
  // overwrites a row the user has already started. Runs once on mount and
  // clears the key immediately.
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
    // One-time mount handoff from the travel calculator (sessionStorage read
    // above), not something derivable at render time.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems((its) => {
      const idx = its.findIndex(isFA018ItemEmpty);
      if (idx === -1) return [...its, filledRow];
      const next = its.slice();
      next[idx] = filledRow;
      return next;
    });
  }, []);

  // Persists on every change so a subsequent unmount doesn't lose it. Gated
  // on `restored`. Prunes the key once the form returns to pristine.
  useEffect(() => {
    if (!restored) return;
    const key = entryDraftKey("FA018");
    if (isFormPristine()) {
      sessionStorage.removeItem(key);
      return;
    }
    sessionStorage.setItem(key, JSON.stringify({ employee, items } satisfies EntryDraftFA018));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, employee, items]);

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
  }, [employee, items, guardToken, pathname]);

  function isFormPristine(): boolean {
    return JSON.stringify(employee) === JSON.stringify(profile) && items.every(isFA018ItemEmpty);
  }

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
    setCollapsedRows(new Set());
  }

  function setEmpField(field: "name" | "position" | "department" | "employeeNo", value: string) {
    setEmployee((e) => ({ ...e, [field]: value }));
  }

  function selectSavedEmployee(saved: SavedEmployeeEntry) {
    const { id: _id, ...snapshot } = saved;
    void _id;
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
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h1 className="font-display text-[28px] font-bold leading-tight">
          กรอกข้อมูลใบรับรองแทนใบเสร็จ
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
                  <span className="italic text-muted">ยังไม่ได้กรอกรายการ</span>
                )
              }
              trailing={`${fmt(num(it.amount))} บาท`}
            >
              <div className="flex flex-wrap gap-3">
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
                <label className={labelClass}>รายการ</label>
                {/* Auto-growing textarea (not a single-line <input>) so long
                    or hard-wrapped text grows the box downward instead of
                    scrolling off sideways. The ref re-measures scrollHeight
                    on every render. */}
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
                    const saved = findSavedItem(value);
                    if (saved) {
                      Object.entries(saved.data).forEach(([field, fieldValue]) =>
                        updateItem(i, field as keyof FA018Item, fieldValue)
                      );
                    }
                  }}
                  rows={1}
                  className={`${inputClass} resize-none overflow-hidden leading-relaxed whitespace-pre-wrap break-words`}
                />
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <SavedItemPicker
                    savedItems={savedItemList}
                    onPick={(desc) => {
                      updateItem(i, "desc", desc);
                      const saved = findSavedItem(desc);
                      if (saved) {
                        Object.entries(saved.data).forEach(([field, fieldValue]) =>
                          updateItem(i, field as keyof FA018Item, fieldValue)
                        );
                      }
                    }}
                    className="max-w-full rounded-chip border border-dashed border-line bg-surface px-3 py-1.5 text-[11px] text-label outline-none focus:border-ink"
                  />
                  <button
                    type="button"
                    onClick={() => setPendingSaveRow(i)}
                    disabled={savingRow === i || !it.desc.trim()}
                    title="บันทึกรายการนี้ไว้ใช้ซ้ำ พิมพ์/เลือกรายการเดิมในแถวอื่นแล้วช่องที่เหลือจะเติมให้อัตโนมัติ"
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
                      updateItem(i, "amount", amount.toFixed(2));
                      if (desc && !it.desc.trim()) updateItem(i, "desc", desc);
                    }}
                  />
                </div>
              </div>
              <div className="min-w-[140px] flex-1">
                <label className={labelClass}>เลขที่โครงการ</label>
                <input
                  value={it.projectNo}
                  onChange={(e) => updateItem(i, "projectNo", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="min-w-[120px] flex-1">
                <label className={labelClass}>จำนวนเงิน</label>
                <input
                  type="number"
                  step="0.01"
                  value={it.amount}
                  onChange={(e) => updateItem(i, "amount", e.target.value)}
                  className={inputClass}
                />
              </div>
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

      <Button
        variant="primary"
        className="self-end"
        onClick={handleCreate}
      >
        สร้างฟอร์ม →
      </Button>

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
