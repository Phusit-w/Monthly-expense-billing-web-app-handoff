"use client";

import { useEffect, useState } from "react";
import { deleteSavedEmployee, saveEmployeeForReuse } from "@/actions/profile";
import EntryEmployeeFields from "@/components/EntryEmployeeFields";
import SavedListManager from "@/components/SavedListManager";
import { dmyFromISODate, todayISODate } from "@/lib/draft";
import { SHOW_PROJECT_FIELD } from "@/lib/constants";
import { num } from "@/lib/format";
import { emptyItemFA017, isFA017ItemEmpty } from "@/lib/types";
import type {
  Draft,
  EmployeeSnapshot,
  FA017Item,
  FA018Item,
  ItemField,
  SavedEmployeeEntry,
  SavedItemEntry,
} from "@/lib/types";
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
  const [items, setItems] = useState<FA017Item[]>(() =>
    Array.from({ length: STARTING_ROWS }, emptyItemFA017)
  );
  // "DATE :" — feeds FA017Form's own DATE: field (top-right of the info
  // table) once handed off to BillEditor. Defaults to today, same as this
  // form always did before this field existed, but is now user-editable
  // rather than fixed at whatever moment "สร้างฟอร์ม" is clicked (e.g. filing
  // a claim a few days after the fact). A native <input type="date"> (per
  // request) — see its lang="en-GB" below for why dd/mm/yyyy display
  // doesn't need a custom widget, and dmyFromISODate (lib/draft.ts) for the
  // Gregorian→Buddhist-era conversion its "yyyy-mm-dd" value still needs.
  const [dateISO, setDateISO] = useState(todayISODate());

  // Claim-level "Project / CC" shortcut, shown in the ข้อมูลพนักงาน card
  // (EntryEmployeeFields — FA017-only, see its comment). Typing here
  // broadcasts the same value into every expense row's own Project/CC
  // field below (it.projectCC) so the common case — one project code for
  // the whole claim — doesn't need retyping per row; each row's field
  // stays individually editable afterward for the rare claim that mixes
  // codes. New rows (addRow) pick up whatever this currently holds.
  const [projectCC, setProjectCCState] = useState("");

  function setProjectCC(value: string) {
    setProjectCCState(value);
    setItems((its) => its.map((it) => ({ ...it, projectCC: value })));
  }

  // Handoff from TravelCalculator ("ส่งไปฟอร์ม FA017") — see
  // EntryFormFA018.tsx's identical effect for the full rationale. Only
  // "Transport & Express way" gets filled, with the calculated travel
  // cost. Everything else on the row is left blank for the user to fill
  // in themselves — Description of Expenses included (see
  // PendingTravelEntry's comment in lib/travelRates.ts: no auto-built text
  // crosses over anymore), Receipt (dropdown only has "" / "Y" / "N", no
  // "no receipt"/N/A option to pick), Project/CC, and every other amount
  // field. "Local Currency Amount" specifically: re-checked against
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
      date: todayISODate(),
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
    setItems((its) => [...its, { ...emptyItemFA017(), projectCC }]);
  }

  function removeLastRow() {
    setItems((its) => (its.length <= 1 ? its : its.slice(0, -1)));
  }

  function handleCreate() {
    const draft: Draft = {
      id: null,
      type: "FA017",
      ...dmyFromISODate(dateISO),
      employee,
      remark: "",
      items,
    };
    onCreate(draft);
  }

  // "สร้างฟอร์ม FA018 →" — hands the same rows off to an FA018 draft instead,
  // carrying over only the three fields both forms share a plain-language
  // meaning for: วันที่ → วันที่, Description of Expenses → รายการ, Local
  // Currency Amount → จำนวนเงิน. Everything FA018 has no equivalent for
  // (Receipt, Project/CC, the six other expense categories) is dropped;
  // เลขที่โครงการ is left blank same as a fresh FA018 row. DATE: does carry
  // over even though FA018Form has no visible field for it (see this file's
  // "DATE :" state comment) — the Draft still stores monthName/monthYear,
  // which RecordsTable's history view groups by, so the date the user
  // actually picked here should win over silently defaulting to today.
  function handleCreateFA018() {
    const draft: Draft = {
      id: null,
      type: "FA018",
      ...dmyFromISODate(dateISO),
      employee,
      remark: "",
      items: items.map(
        (it): FA018Item => ({
          date: it.date,
          desc: it.desc,
          projectNo: "",
          amount: it.localAmt,
        })
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
      <div style={{ fontSize: 20, fontWeight: 700 }}>กรอกข้อมูล F-FA-017 (Employee Expense Claim)</div>

      <EntryEmployeeFields
        employee={employee}
        onChange={setEmpField}
        savedEmployees={savedEmployeeList}
        onSelectSaved={selectSavedEmployee}
        onSave={saveEmployee}
        onDeleteSaved={removeSavedEmployeeEntry}
        projectCC={projectCC}
        onProjectCCChange={setProjectCC}
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
      <div style={{ background: "#fff", border: "1px solid #d8d5cc", borderRadius: 8, padding: "18px 22px" }}>
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
                  <input
                    value={it.desc}
                    onChange={(e) => {
                      const value = e.target.value;
                      updateItem(i, "desc", value);
                      // A saved row's Description was typed or picked from
                      // the datalist below — fill in the rest of that
                      // row's saved fields too (see lib/useSavedItems.ts),
                      // same mechanism EntryEmployeeFields already uses for
                      // saved employee names.
                      const saved = findSavedItem(value);
                      if (saved) {
                        Object.entries(saved.data).forEach(([field, fieldValue]) =>
                          updateItem(i, field as ItemField, fieldValue)
                        );
                      }
                    }}
                    list="saved-items-fa017-desc"
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
                    title="บันทึกรายการนี้ไว้ใช้ซ้ำ พิมพ์/เลือก Description เดิมในแถวอื่นแล้วช่องที่เหลือจะเติมให้อัตโนมัติ"
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
        {/* Shared by every row's Description field's list= attribute above
            — one datalist in the document is enough, HTML doesn't need it
            duplicated per row. */}
        <datalist id="saved-items-fa017-desc">
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

      <div style={{ display: "flex", gap: 10, alignSelf: "flex-end" }}>
        <button
          onClick={handleCreateFA018}
          title="สร้างฟอร์ม F-FA-018 จากรายการชุดนี้ (วันที่, Description of Expenses, Local Currency Amount)"
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
          สร้างฟอร์ม FA018 →
        </button>
        <button
          onClick={handleCreate}
          style={{
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
    </div>
  );
}
