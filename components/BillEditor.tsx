"use client";

import { useEffect, useId, useLayoutEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { saveRecord } from "@/actions/records";
import { billDraftKey, clearBillDraft, readBillDraft, writeBillDraft } from "@/lib/billDraftStorage";
import { armNavGuard, disarmNavGuard } from "@/lib/navGuard";
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
import {
  DEFAULT_ROWS_FA017,
  DEFAULT_ROWS_FA018,
  PAPER_WIDTH_FA017,
  PAPER_WIDTH_FA018,
  THAI_MONTHS,
} from "@/lib/constants";
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
  // Set only by EntryFlow.tsx, which renders this component *in place* of
  // its entry form on the same URL. Two uses: it makes the unsaved-changes
  // guard treat the review as always worth protecting (getting here means
  // real entry-form input), and the recovery banner's "เริ่มใหม่" calls it
  // to un-swap back to the (empty) entry form. EntryFlow passes a callback
  // that flips its own state back. On the standalone /bill routes it's
  // undefined and neither behaviour applies.
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
  const [confirmingSave, setConfirmingSave] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const guardToken = useId();

  // Reload / tab close / hard cross-document navigation while there are
  // unsaved edits: the browser's native "Leave site? Changes you made may
  // not be saved" prompt. `setDraft` always makes a new object, so
  // `draft !== initialDraft` is "the user has edited something".
  //
  // No popstate/history trap for the browser Back button *here* — in the
  // Next App Router `window.history.pushState` is patched to drive the
  // router, so pushing a trap entry stalls client navigation (a sidebar
  // link hangs on "Rendering"). Instead this feeds the shared app-shell
  // guard (lib/navGuard.ts); AppSidebar owns a listen-only popstate handler
  // and intercepts its own nav links to prompt before leaving. beforeunload
  // below still covers the cases that never reach that guard — reload, tab
  // close, hard cross-document navigation.
  const isDirty = draft !== initialDraft;
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  // Arm the shared guard (sidebar links + browser Back) whenever there are
  // unsaved edits. returnHref = this editor's own URL so "กลับไปที่ฟอร์ม"
  // can bounce back to it (the autosave stash above then repopulates it).
  useEffect(() => {
    if (isDirty) armNavGuard(guardToken, pathname);
    else disarmNavGuard(guardToken);
    return () => disarmNavGuard(guardToken);
  }, [isDirty, pathname, guardToken]);

  // Crash/reload recovery (see lib/billDraftStorage.ts). storageKey is
  // derived from props, so it's stable for the life of this editor.
  const storageKey = billDraftKey(initialDraft);
  const [recovered, setRecovered] = useState(false);

  // Restore a stashed draft on mount, before paint (useLayoutEffect) so
  // there's no empty→populated flash. Skipped if the underlying saved
  // record has moved on since the stash was written (someone else saved
  // it) — its optimistic-lock token wouldn't match, so the stash is
  // discarded rather than resurrecting edits against a stale version.
  // The setState here is a one-shot pull of per-tab sessionStorage into
  // state on mount — client-only, so it can't be a useState initializer
  // (that would hydration-mismatch) and there's no server snapshot for
  // useSyncExternalStore. Runs once, hence the empty deps.
  useLayoutEffect(() => {
    const saved = readBillDraft(storageKey);
    if (!saved) return;
    if (saved.id === initialDraft.id && saved.updatedAt !== initialDraft.updatedAt) {
      clearBillDraft(storageKey);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(saved);
    setRecovered(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stash on every edit; the pristine initial draft isn't worth writing.
  useEffect(() => {
    if (draft === initialDraft) return;
    writeBillDraft(storageKey, draft);
  }, [draft, initialDraft, storageKey]);

  // Recovery banner's "เริ่มใหม่จากที่บันทึกไว้": drop the stash and go back
  // to the clean starting point — the friendly entry form in EntryFlow, or
  // the saved/blank draft on the standalone editor routes.
  function discardRecovery() {
    clearBillDraft(storageKey);
    setRecovered(false);
    if (onBack) onBack();
    else setDraft(initialDraft);
  }

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

  // "สร้างฟอร์ม Expense Claim" — the reverse of handleCreateFA018: flips an
  // FA018 bill over to a fresh FA017 draft in place. วันที่ / รายการ /
  // เลขที่โครงการ carry over to Date / Description of Expenses / Project /
  // CC; จำนวนเงิน lands in the "Other" column (FA017 has seven category
  // columns and nothing here says which — re-categorise in the editor).
  // Same id: null semantics — only ever creates a new record on save,
  // never touches the FA018 bill it was built from.
  function handleCreateFA017() {
    setDraft((d) => ({
      id: null,
      updatedAt: null,
      type: "FA017",
      day: d.day,
      monthName: d.monthName,
      monthYear: d.monthYear,
      employee: d.employee,
      remark: "",
      items: padItems(
        (d.items as FA018Item[]).map((it): FA017Item => ({
          ...emptyItemFA017(),
          date: it.date,
          desc: it.desc,
          projectCC: it.projectNo,
          other: it.amount,
        })),
        DEFAULT_ROWS_FA017,
        emptyItemFA017
      ),
    }));
  }

  // The one and only way to get a PDF out of the editor: the browser's own
  // print dialog, whose "Save as PDF" destination renders the A4 `.paper`
  // sheets with Chrome's real layout engine — pixel-identical to the form
  // on screen. An earlier "ดาวน์โหลด PDF" button rasterised the sheets with
  // html2canvas for a one-click download with no dialog, but html2canvas
  // reimplements CSS layout itself and never matched the real render
  // (text drifting onto the table grid lines, wrapped rows clipped); it was
  // removed in favour of this. See lib/exportPdf.ts (now unused) for that
  // history.
  function handlePrint() {
    window.print();
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
      // Saved — the recovery stash for this draft is now obsolete, and the
      // edits are no longer "unsaved", so don't let the guard prompt on the
      // navigation to /records.
      clearBillDraft(storageKey);
      disarmNavGuard(guardToken);
      router.push("/records");
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
      <EditorToolbar
        paperWidth={paperWidth}
        heading={heading}
        auditLine={auditLine}
        onPrint={handlePrint}
        onCreateFA018={draft.type === "FA017" ? handleCreateFA018 : undefined}
        onCreateFA017={draft.type === "FA018" ? handleCreateFA017 : undefined}
        onSave={handleSave}
        saving={pending}
        addRow={addRow}
        removeLastRow={removeLastRow}
      />
      {recovered && (
        <div
          className="no-print mx-auto mb-3 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-peach px-4 py-2 text-[13px] text-black"
          style={{ maxWidth: paperWidth }}
        >
          <span>กู้คืนข้อมูลที่แก้ไขค้างไว้ (ยังไม่ได้บันทึก) จากครั้งก่อน</span>
          <button
            type="button"
            onClick={discardRecovery}
            className="ui-btn whitespace-nowrap rounded-chip border border-black/40 px-3 py-1 text-xs font-medium text-black transition-colors hover:bg-black/5"
          >
            เริ่มใหม่จากที่บันทึกไว้
          </button>
        </div>
      )}
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
          className="no-print mx-auto mb-3 flex items-center gap-2 text-[13px]"
          style={{ maxWidth: paperWidth }}
        >
          <span>ประจำเดือน :</span>
          <select
            value={draft.monthName}
            onChange={(e) => setMonthName(e.target.value)}
            className="rounded-input border border-line bg-surface px-2.5 py-1.5 text-sm"
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
            className="w-20 rounded-input border border-line bg-surface px-2.5 py-1.5 text-sm"
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
      <div>
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
