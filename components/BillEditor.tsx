"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRecord } from "@/actions/records";
import { fa017RowTotal, fa017Totals, fa018Total } from "@/lib/totals";
import { fmt } from "@/lib/format";
import { emptyItemFA017, emptyItemFA018, padItems } from "@/lib/types";
import type {
  Draft,
  EmployeeSnapshot,
  FA017Item,
  FA018Item,
  ItemField,
  SavedItemEntry,
} from "@/lib/types";
import { exportPagesToPdf } from "@/lib/exportPdf";
import {
  DEFAULT_ROWS_FA018,
  PAGE_HEIGHT_BUDGET_FA017,
  PAGE_HEIGHT_BUDGET_FA018,
  PAPER_WIDTH_FA017,
  PAPER_WIDTH_FA018,
  THAI_MONTHS,
} from "@/lib/constants";
import Header from "@/components/Header";
import PageShell from "@/components/PageShell";
import EditorToolbar from "@/components/EditorToolbar";
import FA018Form from "@/components/FA018Form";
import FA017Form from "@/components/FA017Form";
import ConfirmSaveModal from "@/components/ConfirmSaveModal";

// Ported from the editor half of the design source's Component class
// (this.state.draft + addRow/removeRow/updateItem/updateDraftField/saveDraft).
// The draft lives entirely in client state until "บันทึก" writes it to the DB.
export default function BillEditor({
  initialDraft,
  savedItems,
  onBack,
  createdByName,
  updatedByName,
}: {
  initialDraft: Draft;
  savedItems: SavedItemEntry[];
  // Overrides "ย้อนกลับ"'s default router.push (below) — needed by
  // EntryFlow.tsx, which renders this component *in place* of the entry
  // form on the same URL (see its own comment on why) rather than
  // navigating to it. router.push to a URL matching the current one is a
  // no-op in the App Router, so without this override the back button would
  // silently do nothing whenever BillEditor got here via that swap.
  // EntryFlow passes a callback that flips its own state back to show the
  // entry form again instead.
  onBack?: () => void;
  // Audit trail (ExpenseRecordData.createdByName/updatedByName) — undefined
  // for a brand-new, not-yet-saved draft (app/bill/new/[type]/page.tsx),
  // set for an existing record (app/bill/[id]/page.tsx). Display-only:
  // saveRecord (actions/records.ts) always re-stamps these from the current
  // session on save, this component never sends them back.
  createdByName?: string;
  updatedByName?: string;
}) {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [pending, startTransition] = useTransition();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [confirmingSave, setConfirmingSave] = useState(false);
  const router = useRouter();
  // Wraps just the FA017Form/FA018Form output (not Header/EditorToolbar) so
  // exportPagesToPdf's ".paper" query below can't pick up unrelated markup.
  const pagesRef = useRef<HTMLDivElement>(null);
  // Set by handleCreateFA018 right before it flips `draft` over to a fresh
  // FA018 draft in place (no navigation) — holds the FA017 draft exactly as
  // it stood at that moment (including any unsaved edits), so handleBack
  // below can undo the in-place conversion and land back on that same FA017
  // view, instead of navigating away to the entry form as if "ย้อนกลับ" had
  // been clicked on a plain FA017 view that was never converted.
  const preConversionDraftRef = useRef<Draft | null>(null);

  const paperWidth = draft.type === "FA018" ? PAPER_WIDTH_FA018 : PAPER_WIDTH_FA017;
  const heading = draft.id ? "กำลังแก้ไขรายการ" : "สร้างรายการใหม่";
  const auditLine = createdByName
    ? `สร้างโดย ${createdByName}${updatedByName && updatedByName !== createdByName ? ` · แก้ไขล่าสุดโดย ${updatedByName}` : ""}`
    : undefined;

  function setEmpField(field: keyof EmployeeSnapshot, value: string) {
    setDraft((d) => ({ ...d, employee: { ...d.employee, [field]: value } }));
  }

  function setMonthName(value: string) {
    setDraft((d) => ({ ...d, monthName: value }));
  }

  function setMonthYear(value: number) {
    setDraft((d) => ({ ...d, monthYear: value }));
  }

  function setDay(value: number) {
    setDraft((d) => ({ ...d, day: value }));
  }

  function setRemark(value: string) {
    setDraft((d) => ({ ...d, remark: value }));
  }

  function updateItem(i: number, field: ItemField, value: string) {
    setDraft((d) => {
      const items = d.items.slice();
      items[i] = { ...items[i], [field]: value };
      return { ...d, items };
    });
  }

  // No row-count cap: FA017Form/FA018Form now paginate onto additional A4
  // sheets whenever content overflows one page (lib/pagination.ts), so
  // there's no longer a fixed "fits on one page" ceiling to enforce here —
  // each page still renders at exactly one physical A4 page's worth of
  // content, it just spans however many pages the rows need.
  function addRow() {
    setDraft((d) => ({
      ...d,
      items: [...d.items, d.type === "FA018" ? emptyItemFA018() : emptyItemFA017()],
    }));
  }

  function removeLastRow() {
    setDraft((d) => (d.items.length <= 1 ? d : { ...d, items: d.items.slice(0, -1) }));
  }

  // "สร้างฟอร์มใบรับรองแทนใบเสร็จ" — same handoff EntryFormFA017.tsx's
  // identical button does (see its handleCreateFA018 doc comment for the
  // field-mapping rationale: date/desc/Project-CC carry over — Project/CC
  // lands in FA018's "เลขที่โครงการ" column — Receipt drops, remark resets),
  // just triggered from an already-created FA017 bill
  // instead of the entry form. Swaps this same editor over to a fresh
  // FA018 draft in place (BillEditor already picks FA017Form vs FA018Form
  // from draft.type, so nothing else needs to change) — always starts with
  // id: null even if the FA017 draft on screen is already saved (draft.id
  // set), so this only ever creates a new record on save and never touches
  // or overwrites the FA017 bill it was built from.
  //
  // amount uses fa017RowTotal (every category column summed), not just
  // localAmt — people commonly put a row's amount under Transport & Express
  // way, Gasoline, etc. instead of specifically "Local Currency Amount", and
  // an amount-only-from-localAmt mapping silently dropped those, handing
  // off a FA018 row with a description but a blank/zero amount.
  function handleCreateFA018() {
    preConversionDraftRef.current = draft;
    setDraft((d) => ({
      id: null,
      updatedAt: null,
      type: "FA018",
      day: d.day,
      monthName: d.monthName,
      monthYear: d.monthYear,
      employee: d.employee,
      remark: "",
      items: padItems(
        (d.items as FA017Item[]).map((it): FA018Item => {
          const total = fa017RowTotal(it);
          return {
            date: it.date,
            desc: it.desc,
            projectNo: it.projectCC,
            amount: total ? total.toFixed(2) : "",
          };
        }),
        DEFAULT_ROWS_FA018,
        emptyItemFA018
      ),
    }));
  }

  function handleCancel() {
    router.push("/");
  }

  // Default "ย้อนกลับ": navigate to the corresponding friendly entry form
  // (/bill/entry/[type]) rather than browser history — this screen can be
  // reached via a fresh /bill/new/[type] visit or editing /bill/[id], and
  // history isn't a reliable "back" for either (there may be no matching
  // entry-form visit in it at all, e.g. this new-tab handoff route). The
  // onBack prop overrides this entirely for EntryFlow's in-place swap case
  // (see this component's onBack doc comment above) — this branch never
  // runs there. Same tradeoff EntryFlow.tsx's own comment already accepts
  // elsewhere: this doesn't restore whatever was typed into that entry form
  // before landing here, it just starts it fresh.
  //
  // preConversionDraftRef check comes first and pre-empts both of the above:
  // if this FA017 view was just flipped to FA018 in place via "สร้างฟอร์ม
  // ใบรับรองแทนใบเสร็จ" (handleCreateFA018), "ย้อนกลับ" should undo that and
  // land back on the FA017 view the user was actually just looking at —
  // not the FA018/FA017 entry form (routing there via initialDraft.type
  // used to be this function's whole job, back when the only options were
  // "the entry form" or the onBack override; it was never "restore the
  // in-place conversion" because nothing captured the pre-conversion draft
  // to restore).
  function handleBack() {
    if (preConversionDraftRef.current) {
      setDraft(preConversionDraftRef.current);
      preConversionDraftRef.current = null;
      return;
    }
    if (onBack) {
      onBack();
      return;
    }
    router.push(`/bill/entry/${initialDraft.type.toLowerCase()}`);
  }

  function handlePrint() {
    window.print();
  }

  function pdfFilename(): string {
    const name = draft.employee.name.trim().replace(/[\\/:*?"<>|]+/g, "") || "form";
    return `${draft.type}-${name}-${draft.monthName}-${draft.monthYear}.pdf`;
  }

  // "ดาวน์โหลด PDF" — separate from handlePrint's window.print() (which
  // opens the browser's print dialog; saving as PDF there is just one of
  // several destinations the user has to pick). This downloads the .pdf
  // file directly in one click, no dialog. See lib/exportPdf.ts.
  async function handleDownloadPdf() {
    if (!pagesRef.current || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      await exportPagesToPdf(pagesRef.current, pdfFilename(), {
        widthPx: parseFloat(paperWidth),
        heightPx: draft.type === "FA018" ? PAGE_HEIGHT_BUDGET_FA018 : PAGE_HEIGHT_BUDGET_FA017,
      });
    } finally {
      setDownloadingPdf(false);
    }
  }

  // "บันทึก" (EditorToolbar) opens ConfirmSaveModal instead of saving
  // straight away — handleConfirmSave below is what actually calls
  // saveRecord, once the user confirms there.
  function handleSave() {
    setConfirmingSave(true);
  }

  function handleConfirmSave() {
    startTransition(async () => {
      const result = await saveRecord(draft);
      if (!result.ok) {
        // Someone else saved (or deleted) this same record after this page
        // loaded — saveRecord's optimistic-locking check refused to
        // overwrite it blindly (see actions/records.ts). Stay on this page
        // with the user's edits intact rather than navigating away, so
        // nothing they typed is lost — they can copy anything still needed
        // before reloading to pick up the latest saved version.
        setConfirmingSave(false);
        window.alert(
          "บันทึกไม่สำเร็จ: มีคนอื่นแก้ไขรายการนี้ไปแล้วหลังจากที่คุณเปิดหน้านี้ " +
            "กรุณาโหลดหน้านี้ใหม่เพื่อดูข้อมูลล่าสุดก่อนแก้ไขต่อ (การแก้ไขของคุณในหน้านี้ยังไม่หาย แต่ยังไม่ถูกบันทึก)"
        );
        return;
      }
      router.push("/");
    });
  }

  const modalTotal =
    draft.type === "FA018" ? fa018Total(draft.items as FA018Item[]) : fa017Totals(draft.items as FA017Item[]).thb;

  return (
    <PageShell>
      {/* Per-type page size for print/PDF — mirrors Component.ensurePageStyle.
          margin: 0 is deliberate: PAPER_WIDTH_FA017/FA018 (lib/constants.ts)
          are already the FULL physical A4 width in each orientation
          (794px/1123px ≈ 210mm/297mm), with .paper's own padding providing
          the visual inset. A nonzero @page margin used to shrink the
          printable area *on top of* that already-full-width paper, pushing
          ~10mm off the right/bottom edge on every print/PDF. */}
      <style>{`@page { size: A4 ${draft.type === "FA018" ? "portrait" : "landscape"}; margin: 0; }`}</style>
      <Header />
      <EditorToolbar
        paperWidth={paperWidth}
        heading={heading}
        auditLine={auditLine}
        onBack={handleBack}
        onCancel={handleCancel}
        onPrint={handlePrint}
        onDownloadPdf={handleDownloadPdf}
        downloadingPdf={downloadingPdf}
        onCreateFA018={draft.type === "FA017" ? handleCreateFA018 : undefined}
        onSave={handleSave}
        saving={pending}
        addRow={addRow}
        removeLastRow={removeLastRow}
      />
      {/* FA018's printed form has no "ประจำเดือน" field (removed from
          FA018Form.tsx per an earlier request — see that file's comment),
          but draft.monthName/monthYear are still real data RecordsTable
          groups/displays by (defaulted to the current month when the draft
          is created). Without this, there was no way to actually change
          that value for an FA018 draft after creation — editing-only
          control, same no-print treatment as EditorToolbar above it, so it
          never shows up on print or the "ดาวน์โหลด PDF" export (that path
          only captures ".paper" nodes below, which this sits outside of
          anyway). FA017 doesn't need this — its own DATE field already
          edits the same two fields as part of its d/m/y control. */}
      {draft.type === "FA018" && (
        <div
          className="no-print"
          style={{
            maxWidth: paperWidth,
            margin: "0 auto 12px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
          }}
        >
          <span>ประจำเดือน :</span>
          <select
            value={draft.monthName}
            onChange={(e) => setMonthName(e.target.value)}
            style={{ font: "inherit", padding: "4px 6px" }}
          >
            {THAI_MONTHS.map((label, i) => (
              <option key={label} value={String(i + 1)}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={draft.monthYear}
            onChange={(e) => setMonthYear(Number(e.target.value))}
            style={{ font: "inherit", padding: "4px 6px", width: 80 }}
          />
        </div>
      )}
      <ConfirmSaveModal
        open={confirmingSave}
        heading={heading}
        saving={pending}
        onCancel={() => setConfirmingSave(false)}
        onConfirm={handleConfirmSave}
        rows={[
          { label: "ประเภทฟอร์ม", value: draft.type === "FA018" ? "ใบรับรองแทนใบเสร็จ (FA018)" : "Expense Claim (FA017)" },
          { label: "ชื่อพนักงาน", value: draft.employee.name.trim() || "-" },
          { label: "เดือน/ปี", value: draft.monthName ? `${draft.monthName} ${draft.monthYear}` : "-" },
          { label: "ยอดรวม", value: fmt(modalTotal) },
        ]}
      />
      <div ref={pagesRef}>
        {draft.type === "FA018" ? (
          <FA018Form
            draft={draft}
            setEmpField={setEmpField}
            updateItem={updateItem}
            savedItems={savedItems}
            addRow={addRow}
          />
        ) : (
          <FA017Form
            draft={draft}
            setEmpField={setEmpField}
            setMonthName={setMonthName}
            setMonthYear={setMonthYear}
            setDay={setDay}
            setRemark={setRemark}
            updateItem={updateItem}
            savedItems={savedItems}
            addRow={addRow}
          />
        )}
      </div>
    </PageShell>
  );
}
