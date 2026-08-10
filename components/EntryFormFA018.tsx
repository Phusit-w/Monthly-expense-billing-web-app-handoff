"use client";

import { useEffect, useState } from "react";
import { deleteSavedEmployee, saveEmployeeForReuse } from "@/actions/profile";
import EntryEmployeeFields from "@/components/EntryEmployeeFields";
import SavedListManager from "@/components/SavedListManager";
import { currentDMY, todayISODate } from "@/lib/draft";
import { emptyItemFA018, isFA018ItemEmpty } from "@/lib/types";
import type { Draft, EmployeeSnapshot, FA018Item, SavedEmployeeEntry, SavedItemEntry } from "@/lib/types";
import { pendingTravelEntryKey } from "@/lib/travelRates";
import type { PendingTravelEntry } from "@/lib/travelRates";
import { useSavedItems } from "@/lib/useSavedItems";

const STARTING_ROWS = 3;

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
  const [items, setItems] = useState<FA018Item[]>(() =>
    Array.from({ length: STARTING_ROWS }, emptyItemFA018)
  );

  // Handoff from TravelCalculator ("ส่งไปฟอร์ม FA018"): fills the first
  // still-blank row (or appends one if every row already has something in
  // it) with the calculated travel cost — only "จำนวนเงิน" (amount) is
  // filled; "รายการ" is left blank for the user to type themselves (see
  // PendingTravelEntry's comment in lib/travelRates.ts), "เลขที่โครงการ"
  // stays blank same as any other new row, "วันที่" defaults to today same
  // as it already did. Never overwrites a row the user has already started
  // filling in. Runs once on mount only, and clears the key immediately so
  // it isn't reapplied on a later remount/revisit.
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
      date: todayISODate(),
      desc: "",
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

  function setEmpField(field: "name" | "position" | "department" | "employeeNo", value: string) {
    setEmployee((e) => ({ ...e, [field]: value }));
  }

  // Picking a saved name (EntryEmployeeFields' datalist) replaces the whole
  // snapshot, office included — office has no field of its own in this
  // roomy entry form, but it's still real data that differs per saved
  // person, same as the other four fields. `id` is dropped — `employee`
  // state is a plain EmployeeSnapshot (what ends up in the Draft), the id
  // only matters for the saved-list's own bookkeeping above.
  function selectSavedEmployee(saved: SavedEmployeeEntry) {
    const { id: _id, ...snapshot } = saved;
    setEmployee(snapshot);
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

  function handleCreate() {
    const draft: Draft = {
      id: null,
      type: "FA018",
      ...currentDMY(),
      employee,
      remark: "",
      items,
    };
    onCreate(draft);
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 20, fontWeight: 700 }}>กรอกข้อมูล F-FA-018 (รายงานค่าใช้จ่ายไม่มีบิล)</div>

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
                <input
                  value={it.desc}
                  onChange={(e) => {
                    const value = e.target.value;
                    updateItem(i, "desc", value);
                    // A saved row's รายการ was typed or picked from the
                    // datalist below — fill in the rest of that row's
                    // saved fields too (see lib/useSavedItems.ts), same
                    // mechanism EntryEmployeeFields already uses for saved
                    // employee names.
                    const saved = findSavedItem(value);
                    if (saved) {
                      Object.entries(saved.data).forEach(([field, fieldValue]) =>
                        updateItem(i, field as keyof FA018Item, fieldValue)
                      );
                    }
                  }}
                  list="saved-items-fa018-desc"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={async () => {
                    setSavingRow(i);
                    setJustSavedRow(null);
                    await saveItemRow(items[i]);
                    setSavingRow(null);
                    setJustSavedRow(i);
                    setTimeout(() => setJustSavedRow((r) => (r === i ? null : r)), 2000);
                  }}
                  disabled={savingRow === i || !it.desc.trim()}
                  title="บันทึกรายการนี้ไว้ใช้ซ้ำ พิมพ์/เลือกรายการเดิมในแถวอื่นแล้วช่องที่เหลือจะเติมให้อัตโนมัติ"
                  style={{
                    marginTop: 6,
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
        {/* Shared by every row's รายการ field's list= attribute above — one
            datalist in the document is enough, HTML doesn't need it
            duplicated per row. */}
        <datalist id="saved-items-fa018-desc">
          {savedItemList.map((entry) => (
            <option key={entry.desc} value={entry.desc} />
          ))}
        </datalist>
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
          background: "#1c1c1c",
          color: "#fff",
          borderRadius: 6,
          font: "inherit",
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        สร้างฟอร์ม →
      </button>
    </div>
  );
}
