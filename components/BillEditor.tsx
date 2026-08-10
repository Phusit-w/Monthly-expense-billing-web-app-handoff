"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRecord } from "@/actions/records";
import { emptyItemFA017, emptyItemFA018 } from "@/lib/types";
import type { Draft, EmployeeSnapshot, ItemField, SavedItemEntry } from "@/lib/types";
import { PAPER_WIDTH_FA017, PAPER_WIDTH_FA018 } from "@/lib/constants";
import Header from "@/components/Header";
import PageShell from "@/components/PageShell";
import EditorToolbar from "@/components/EditorToolbar";
import FA018Form from "@/components/FA018Form";
import FA017Form from "@/components/FA017Form";

// Ported from the editor half of the design source's Component class
// (this.state.draft + addRow/removeRow/updateItem/updateDraftField/saveDraft).
// The draft lives entirely in client state until "บันทึก" writes it to the DB.
export default function BillEditor({
  initialDraft,
  savedItems,
}: {
  initialDraft: Draft;
  savedItems: SavedItemEntry[];
}) {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const paperWidth = draft.type === "FA018" ? PAPER_WIDTH_FA018 : PAPER_WIDTH_FA017;
  const heading = draft.id ? "กำลังแก้ไขรายการ" : "สร้างรายการใหม่";

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

  function handleCancel() {
    router.push("/");
  }

  function handlePrint() {
    window.print();
  }

  function handleSave() {
    startTransition(async () => {
      await saveRecord(draft);
      router.push("/");
    });
  }

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
        onCancel={handleCancel}
        onPrint={handlePrint}
        onSave={handleSave}
        saving={pending}
        addRow={addRow}
        removeLastRow={removeLastRow}
      />
      {draft.type === "FA018" ? (
        <FA018Form
          draft={draft}
          setEmpField={setEmpField}
          updateItem={updateItem}
          savedItems={savedItems}
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
        />
      )}
    </PageShell>
  );
}
