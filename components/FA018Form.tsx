"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";
import { PAGE_HEIGHT_BUDGET_FA018, PAPER_PADDING_FA018, PAPER_WIDTH_FA018 } from "@/lib/constants";
import { fmt, joinDMY, splitDMY } from "@/lib/format";
import { computeFillerCounts, computePageBreaks, ensureLastPageHasContent, fillerCountsEqual, pageBreaksEqual } from "@/lib/pagination";
import { fa018Total } from "@/lib/totals";
import { isFA018ItemEmpty } from "@/lib/types";
import type { Draft, EmployeeSnapshot, FA018Item, ItemField, SavedItemEntry } from "@/lib/types";
import { useSavedItems } from "@/lib/useSavedItems";
import ConfirmDialog from "@/components/ConfirmDialog";
import SavedListManager from "@/components/SavedListManager";

// display:block (not the inline-block an <input>/<textarea> is by default)
// so the cell's verticalAlign:middle actually centres it — an inline
// control sits on the text baseline and rides up against the top border in
// a tall row.
const cellInput: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  border: "none",
  font: "inherit",
  background: "transparent",
};

const th: React.CSSProperties = { border: "1px solid #000", padding: 6 };
// 3px top/bottom padding + verticalAlign:middle keeps every value centred in
// its cell and clear of the borders (Thai upper vowel marks included).
const td: React.CSSProperties = { border: "1px solid #000", padding: "3px 4px", verticalAlign: "middle" };

// วันที่ / รายการ / เลขที่โครงการ / จำนวนเงิน — matches the item table
// header's existing 12%/16%/15% explicit widths, with รายการ taking the
// remainder (100 - 12 - 16 - 15 = 57). Shared with the signature block
// below (via colTemplate) so ผู้ขอเบิก/ผู้อนุมัติ line up with the table's
// actual column frames instead of an unrelated 2-column split.
const COL_PCT = [12, 57, 16, 15];

interface FA018FormProps {
  draft: Draft;
  setEmpField: (field: keyof EmployeeSnapshot, value: string) => void;
  updateItem: (i: number, field: ItemField, value: string) => void;
  savedItems: SavedItemEntry[];
  // Appends a real blank item to draft.items — same action as
  // EditorToolbar's "+ เพิ่มแถว" button, reused here so focusing a blank
  // filler row (see the filler-row block in renderPage below) promotes it
  // into a real, editable row instead of leaving the click dead.
  addRow: () => void;
}

// Screen-only "save this row" icon — see the desc <td>'s comment below for
// why it's absolutely positioned rather than its own table column. Kept
// deliberately subtle (low opacity at rest) so it doesn't visually compete
// with the actual รายการ text; `.no-print` (globals.css) removes it from
// the printed/PDF output entirely, so it has zero effect on the form's
// pixel-perfect print fidelity.
const saveIconBtn: React.CSSProperties = {
  position: "absolute",
  top: 1,
  right: 1,
  width: 14,
  height: 14,
  padding: 0,
  lineHeight: "14px",
  fontSize: 9,
  border: "none",
  cursor: "pointer",
};

// Screen-only "pick a saved row" trigger — see its usage comment below for
// why this is a <select> rather than an <input list=…> pair. Sits at the
// opposite corner from saveIconBtn so the two controls don't overlap.
const pickerSelect: React.CSSProperties = {
  position: "absolute",
  top: 1,
  left: 1,
  width: 14,
  height: 14,
  padding: 0,
  lineHeight: "14px",
  fontSize: 8,
  border: "none",
  background: "transparent",
  cursor: "pointer",
};

// Ported 1:1 from the `isFA018` sc-if block in the design source: paper
// header, employee/month fields, item table, certification text, signatures.
//
// Pagination: no cap on how many rows "+ เพิ่มแถว" can add — every render
// checks the actual rendered page height against PAGE_HEIGHT_BUDGET_FA018
// and, when it's over, falls back to splitting rows across multiple
// ".paper" sheets, packing as many as actually fit per page (see
// lib/pagination.ts) — not a fixed count. รายการ is a plain <input> (no
// wrap/grow, unlike FA017's Description textarea), so a row's height is
// fixed — content wrapping isn't what triggers a split here, adding enough
// rows is. Every page repeats the full header, but only the LAST page
// carries the รวม row: earlier pages end right after their own rows, and
// the last page's รวม is the grand total across every page, not just its
// own — which also means a non-last page can fit slightly more rows than
// the last one, since it doesn't need to leave room for that block.
// Certification/signature stays on every page unchanged (see the
// "keep-together" block below).
export default function FA018Form({
  draft,
  setEmpField,
  updateItem,
  savedItems,
  addRow,
}: FA018FormProps) {
  const items = draft.items as FA018Item[];
  const colTemplate = COL_PCT.map((p) => `${p}%`).join(" ");

  // Save/reuse individual expense rows by their รายการ text (see
  // lib/useSavedItems.ts) — mirrors EntryFormFA018's identical feature;
  // justSavedRow tracks a brief ✓ flash on the icon button below, keyed by
  // absolute row index since any row can be saved independently.
  const {
    items: savedItemList,
    findMatch: findSavedItem,
    save: saveItemRow,
    remove: removeSavedItem,
  } = useSavedItems("FA018", savedItems);
  const [justSavedRow, setJustSavedRow] = useState<number | null>(null);
  // Row awaiting "ยืนยันการบันทึก" confirmation before the 💾 icon button
  // actually calls saveItemRow — see EntryFormFA017.tsx's identical field
  // for why (saveItemForReuse upserts keyed by รายการ text, so re-saving an
  // existing one silently overwrites it).
  const [pendingSaveRow, setPendingSaveRow] = useState<number | null>(null);

  async function confirmSaveRow() {
    const i = pendingSaveRow;
    if (i === null) return;
    setPendingSaveRow(null);
    await saveItemRow(items[i]);
    setJustSavedRow(i);
    setTimeout(() => setJustSavedRow((r) => (r === i ? null : r)), 2000);
  }

  const firstPageRef = useRef<HTMLDivElement>(null);
  const theadRef = useRef<HTMLTableSectionElement>(null);
  // Only mounted on whichever page is currently last (the รวม row now only
  // renders there — see renderPage below), unlike theadRef which is pinned
  // to page 0 since that content is identical on every page.
  const totalsTbodyRef = useRef<HTMLTableSectionElement>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
  // Measures one blank filler row's real rendered height — see FA017Form's
  // identical ref for the full rationale (single measurement covers every
  // page, since every filler row renders identically).
  const probeFillerRowRef = useRef<HTMLTableRowElement | null>(null);
  // Set by a filler row's onFocus (below) to the index the newly-appended
  // real item will land at — see FA017Form's identical ref for the full
  // rationale (addRow() replaces the filler <tr> with a real one at a new
  // DOM node, which otherwise silently drops focus).
  const pendingFocusIndexRef = useRef<number | null>(null);
  const [pages, setPages] = useState<number[][] | null>(null);
  // Blank rows appended to each page's own tbody past its real rows — see
  // FA017Form's identical state for the full rationale (lib/pagination.ts's
  // top comment has the design reasoning). Only populated in multi-page
  // mode; the common single-page case stays exactly as it already was.
  const [fillerCounts, setFillerCounts] = useState<number[] | null>(null);
  // Also measured, not hardcoded — see probeFillerRowRef above.
  const [fillerRowHeight, setFillerRowHeight] = useState<number | null>(null);

  // pages is only reconciled by the remeasure() effect below, which runs
  // AFTER render — see FA017Form's identical guard for why a stale pages
  // (e.g. right after removeLastRow shrinks draft.items) must be ignored
  // for this render rather than mapped into items[i], which would crash
  // fa018Total downstream on an out-of-range absolute index.
  const pagesRowCount = pages?.reduce((sum, page) => sum + page.length, 0) ?? -1;
  const effectivePages = pages !== null && pagesRowCount === items.length ? pages : [items.map((_, i) => i)];
  // Same staleness guard as effectivePages above, applied to fillerCounts.
  const effectiveFillerCounts =
    fillerCounts !== null && fillerCounts.length === effectivePages.length
      ? fillerCounts
      : effectivePages.map(() => 0);
  const probeFillerPageIndex = effectiveFillerCounts.findIndex((c) => c > 0);

  // รายการ's font-swap re-measure — identical rationale to FA017Form's copy
  // of this same effect (see there for the full explanation): the desc
  // textarea's ref callback re-measures scrollHeight on every render, which
  // covers active typing fine, but content already on screen at mount can
  // be measured against the fallback font before next/font's Sarabun swap
  // finishes, understating the row's true height until some other render
  // happens to re-trigger it. document.fonts.ready re-runs the measurement
  // once every face has actually settled, then triggers a pagination
  // remeasure too since the swap can itself push a page over budget.
  useLayoutEffect(() => {
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      rowRefs.current.forEach((tr) => {
        tr.querySelectorAll<HTMLTextAreaElement>("textarea.desc-textarea").forEach((el) => {
          el.style.height = "auto";
          el.style.height = `${el.scrollHeight}px`;
        });
      });
      remeasure();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function remeasure() {
    // See pendingFocusIndexRef's declaration above and FA017Form's identical
    // block for the full rationale — in short: the promoted row can remount
    // twice (once for the stale-pages fallback's transitional "mega page",
    // once when the real split settles), each time dropping focus to
    // <body>, so this keeps reclaiming it only while focus is actually
    // sitting on <body> (never stealing it from something the user
    // legitimately focused since) until the render is the settled one.
    if (pendingFocusIndexRef.current !== null) {
      const settled = pages === null || pagesRowCount === items.length;
      if (document.activeElement === document.body) {
        const tr = rowRefs.current.get(pendingFocusIndexRef.current);
        const ta = tr?.querySelector<HTMLTextAreaElement>("textarea.desc-textarea");
        ta?.focus();
      }
      if (settled) {
        pendingFocusIndexRef.current = null;
      }
    }
    if (effectivePages.length === 1 && firstPageRef.current) {
      const h = firstPageRef.current.getBoundingClientRect().height;
      if (h <= PAGE_HEIGHT_BUDGET_FA018) {
        if (pages !== null) setPages(null);
        if (fillerCounts !== null) setFillerCounts(null);
        return;
      }
    }
    // Measured as deltas between real rendered edges rather than summing
    // each piece's own height — see FA017Form's identical remeasure() for
    // why (in short: summing drops .paper's own padding, which a delta
    // against the owning .paper's real top/bottom edge accounts for
    // automatically). theadRef always lives on page 0 (every page repeats
    // the same header), so its delta is read against firstPageRef.
    const headerHeight = theadRef.current
      ? theadRef.current.getBoundingClientRect().bottom - (firstPageRef.current?.getBoundingClientRect().top ?? 0)
      : 0;
    // Content only (excludes .paper's own bottom padding, already baked
    // into the paper.bottom - itemsTable.bottom delta below) — that reserve
    // is folded into budgetPx instead, applied once per page uniformly, and
    // must not be counted twice here. This is the part every page pays
    // regardless of last/non-last — the รวม row (measured separately below)
    // is extra, paid only by whichever page is last.
    //
    // Measured from the item <table>'s own bottom edge (found via theadRef's
    // ancestor) rather than from the certification/signature block's wrapper
    // div — see FA017Form's identical fix for the full rationale: that
    // wrapper has no border/padding of its own, so its inner content's
    // marginTop collapses straight through it, silently dropping that margin
    // from every quantity remeasure() sums and letting one row too many get
    // packed onto a page before it visibly overflows past A4.
    const itemsTable = theadRef.current?.closest("table") ?? null;
    const recurringTailHeight = itemsTable
      ? (firstPageRef.current?.getBoundingClientRect().bottom ?? 0) - itemsTable.getBoundingClientRect().bottom - PAPER_PADDING_FA018
      : 0;
    // The รวม row's own height alone (not a delta) — only the last page
    // pays this, reserved separately per page in computePageBreaks below.
    const lastPageExtraHeight = totalsTbodyRef.current?.getBoundingClientRect().height ?? 0;
    const rowHeights = items.map((_, i) => rowRefs.current.get(i)?.getBoundingClientRect().height ?? 0);
    // PAPER_PADDING_FA018 reserves every page's own bottom padding (see
    // recurringTailHeight's comment above); the extra 2px is a small safety
    // margin for sub-pixel rounding. Shared with computeFillerCounts below
    // so blank rows are padded against the exact same per-page budget real
    // rows were packed against.
    const budgetPx = PAGE_HEIGHT_BUDGET_FA018 - PAPER_PADDING_FA018 - 2;
    const rawNext = computePageBreaks({ headerHeight, recurringTailHeight, lastPageExtraHeight, rowHeights, budgetPx });
    const isTrivial = rawNext.length === 1 && rawNext[0].length === items.length;
    if (isTrivial) {
      if (pages !== null) setPages(null);
      if (fillerCounts !== null) setFillerCounts(null);
      return;
    }
    // A spillover page holding only blank/padding rows reads as an empty
    // extra sheet with nothing but รวม on it — pull the previous page's
    // last row over too so it shows real content instead (see this
    // function's own doc comment in lib/pagination.ts).
    const next = ensureLastPageHasContent(rawNext, (i) => isFA018ItemEmpty(items[i]));
    if (pages === null || !pageBreaksEqual(pages, next)) {
      setPages(next);
    }

    // Multi-page only — see FA017Form's identical block for the full
    // rationale (in short: pad each page's leftover space with blank
    // filler rows instead of the old row-rebalancing approach).
    const nextFillerCounts = computeFillerCounts({
      pages: next,
      rowHeights,
      headerHeight,
      recurringTailHeight,
      lastPageExtraHeight,
      budgetPx,
      fillerRowHeight,
    });
    if (fillerCounts === null || !fillerCountsEqual(fillerCounts, nextFillerCounts)) {
      setFillerCounts(nextFillerCounts);
    }
    if (probeFillerRowRef.current) {
      const measured = probeFillerRowRef.current.getBoundingClientRect().height;
      if (measured > 0 && (fillerRowHeight === null || Math.abs(fillerRowHeight - measured) > 0.5)) {
        setFillerRowHeight(measured);
      }
    }
  }

  useLayoutEffect(() => {
    remeasure();
  }); // no dependency array — idempotent, see FA017Form's identical effect for rationale

  function renderPage(pageIndices: number[], pageIndex: number) {
    // Only the last page carries the รวม row (see this component's doc
    // comment) — and when it does, it's the grand total across every
    // page's rows (fa018Total accepts any array, so the full items array
    // works as-is), not just this page's own slice.
    const isLastPage = pageIndex === effectivePages.length - 1;
    const grandTotal = fmt(fa018Total(items));
    return (
      <div
        key={pageIndex}
        ref={pageIndex === 0 ? firstPageRef : undefined}
        className="paper"
        style={{ width: PAPER_WIDTH_FA018, padding: `${PAPER_PADDING_FA018}px 40px` }}
      >
        <div>
          {/* "F-FA-018" moved to its own line above the logo/title row (per
              request) rather than sharing it as a third grid column. The
              grid below keeps that same third (90px) column, now empty, so
              its width still balances the 90px logo column and the title
              stays centered exactly as before. */}
          <div style={{ textAlign: "right", fontSize: 12, color: "#555" }}>
            F-FA-018
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "90px 1fr 90px",
              alignItems: "center",
            }}
          >
            <Image
              src="/icn-logo.png"
              alt="ICN"
              height={44}
              width={180}
              style={{ height: 44, width: "auto", justifySelf: "start" }}
            />
            <div>
              <div style={{ textAlign: "center", fontWeight: 700, fontSize: 16 }}>
                บริษัท อินฟอร์เมชั่น แอนด์ คอมมิวนิเคชั่น เน็ทเวิร์คส จำกัด (มหาชน)
              </div>
              <div
                style={{
                  textAlign: "center",
                  fontWeight: 700,
                  fontSize: 15,
                  marginTop: 4,
                  textDecoration: "underline",
                }}
              >
                รายงานค่าใช้จ่ายไม่มีบิล (ใบรับรองแทนใบเสร็จรับเงิน)
              </div>
            </div>
            <div />
          </div>

          <div style={{ display: "flex", gap: 20, marginTop: 18, fontSize: 13 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, flex: 2 }}>
              <span>ชื่อ</span>
              <input
                value={draft.employee.name}
                onChange={(e) => setEmpField("name", e.target.value)}
                placeholder="ชื่อ-นามสกุล"
                style={{ flex: 1, border: "none", borderBottom: "1px solid #999", padding: "2px 4px", font: "inherit", background: "transparent" }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, flex: 1 }}>
              <span>ฝ่าย / แผนก</span>
              <input
                value={draft.employee.department}
                onChange={(e) => setEmpField("department", e.target.value)}
                style={{ flex: 1, border: "none", borderBottom: "1px solid #999", padding: "2px 4px", font: "inherit", background: "transparent" }}
              />
            </div>
          </div>
          {/* "ประจำเดือน" (month) removed from this form's UI per request — the
              draft still carries monthName/monthYear (defaulted to the current
              month when the draft is created, see app/bill/new/[type]/page.tsx)
              since RecordsTable's history view still groups/displays by it;
              only the editable field on this specific form is gone. */}
          <div style={{ display: "flex", gap: 20, marginTop: 8, fontSize: 13, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, flex: 2 }}>
              <span>ตำแหน่ง</span>
              <input
                value={draft.employee.position}
                onChange={(e) => setEmpField("position", e.target.value)}
                style={{ flex: 1, border: "none", borderBottom: "1px solid #999", padding: "2px 4px", font: "inherit", background: "transparent" }}
              />
            </div>
            {/* Empty flex:1 placeholder — no content, no border. Mirrors the
                "ฝ่าย / แผนก" column's width from the row above (now that
                "ประจำเดือน" no longer occupies it) purely so ตำแหน่ง's
                underline ends at the same x-position as ชื่อ's above it,
                instead of stretching to fill the row on its own. */}
            <div style={{ flex: 1 }} />
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16, fontSize: 12, tableLayout: "fixed" }}>
          <colgroup>
            {COL_PCT.map((p, i) => (
              <col key={i} style={{ width: `${p}%` }} />
            ))}
          </colgroup>
          <thead ref={pageIndex === 0 ? theadRef : undefined}>
            <tr>
              <th style={th}>วันที่</th>
              <th style={th}>รายการ</th>
              <th style={th}>เลขที่โครงการ</th>
              <th style={th}>จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody>
            {pageIndices.map((i) => {
              const it = items[i];
              const { d, m, y } = splitDMY(it.date);
              return (
              <tr
                key={i}
                ref={(el) => {
                  if (el) rowRefs.current.set(i, el);
                  else rowRefs.current.delete(i);
                }}
              >
                <td style={td}>
                  {/* Was a native <input type="date"> — its calendar dropdown
                      is tall enough to visually cover several rows below it
                      in a table this dense, so a click meant for a different
                      field often landed on dead space inside the still-open
                      popup instead of that field, leaving it stuck open (see
                      lib/format.ts's splitDMY/joinDMY comment). Plain
                      day/month/year number inputs — same fix FA017Form's item
                      rows already use — have no popup to get stuck on. */}
                  {/* "/" separators only render once the row has at least one
                      date part filled in — an untouched row should read as a
                      fully blank cell, not "  /  /  ", per request. The three
                      number inputs themselves stay rendered unconditionally
                      either way so the cell is always clickable to start
                      entering a date. */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={d}
                      onChange={(e) => updateItem(i, "date", joinDMY(e.target.value, m, y))}
                      className="no-spin"
                      style={{ width: 16, boxSizing: "border-box", border: "none", background: "transparent", font: "inherit", padding: 0, textAlign: "center" }}
                    />
                    {(d || m || y) && <span>/</span>}
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={m}
                      onChange={(e) => updateItem(i, "date", joinDMY(d, e.target.value, y))}
                      className="no-spin"
                      style={{ width: 16, boxSizing: "border-box", border: "none", background: "transparent", font: "inherit", padding: 0, textAlign: "center" }}
                    />
                    {(d || m || y) && <span>/</span>}
                    <input
                      type="number"
                      value={y}
                      onChange={(e) => updateItem(i, "date", joinDMY(d, m, e.target.value))}
                      className="no-spin"
                      style={{ width: 32, boxSizing: "border-box", border: "none", background: "transparent", font: "inherit", padding: 0, textAlign: "center" }}
                    />
                  </div>
                </td>
                <td style={{ ...td, position: "relative" }}>
                  {/* Auto-growing textarea, same fix as FA017Form's
                      Description column (see its identical comment): a plain
                      rows={1} textarea doesn't grow with wrapped content on
                      its own — Chrome just scrolls it internally — so this
                      ref re-measures scrollHeight on every render (mount and
                      each keystroke alike) and pins the textarea's own
                      height to it, growing the row to fit whenever รายการ
                      wraps past one line. The font-ready effect above
                      re-runs this same measurement for content on screen
                      without any edit of its own to trigger a re-render. */}
                  <textarea
                    ref={(el) => {
                      if (el) {
                        el.style.height = "auto";
                        el.style.height = `${el.scrollHeight}px`;
                      }
                    }}
                    className="desc-textarea"
                    value={it.desc}
                    onChange={(e) => {
                      const value = e.target.value;
                      updateItem(i, "desc", value);
                      // Typing the exact text of a previously-saved row
                      // (see the picker <select> below for the discoverable
                      // way to do this) still auto-fills the rest of its
                      // saved fields, same lookup lib/useSavedItems.ts uses
                      // everywhere else.
                      const saved = findSavedItem(value);
                      if (saved) {
                        Object.entries(saved.data).forEach(([field, fieldValue]) =>
                          updateItem(i, field as ItemField, fieldValue)
                        );
                      }
                    }}
                    rows={1}
                    style={{ ...cellInput, resize: "none", overflow: "hidden", whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.3 }}
                  />
                  {/* Screen-only "pick a saved row" control — a plain
                      <input list=…>/<datalist> pair (used everywhere else
                      in the app for this exact "type or pick a saved key"
                      interaction) isn't an option here since HTML's `list`
                      attribute only works on <input>, not <textarea>
                      (needed above for auto-growing รายการ). A native
                      <select> gives the same "see your saved rows, pick
                      one" affordance without that restriction — value
                      always resets back to "" right after a pick so the
                      trigger box (kept tiny and `.no-arrow`'d) stays a
                      reusable icon rather than displaying whatever was last
                      chosen. */}
                  <select
                    className="no-print no-arrow"
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
                    disabled={savedItemList.length === 0}
                    title="เลือกรายการที่เคยบันทึกไว้"
                    style={{ ...pickerSelect, opacity: savedItemList.length ? 0.4 : 0.15 }}
                  >
                    <option value="">▾</option>
                    {savedItemList.map((entry) => (
                      <option key={entry.desc} value={entry.desc}>
                        {entry.desc}
                      </option>
                    ))}
                  </select>
                  {/* Screen-only "save this row for reuse" icon — see
                      saveIconBtn's comment above. */}
                  <button
                    type="button"
                    className="no-print ui-btn rounded-[3px] bg-transparent transition-colors hover:bg-black/5"
                    onClick={() => setPendingSaveRow(i)}
                    disabled={!it.desc.trim()}
                    title="บันทึกรายการนี้ไว้ใช้ซ้ำ"
                    style={{ ...saveIconBtn, opacity: it.desc.trim() ? 0.4 : 0.15 }}
                  >
                    {justSavedRow === i ? "✓" : "💾"}
                  </button>
                </td>
                <td style={td}>
                  <input
                    value={it.projectNo}
                    onChange={(e) => updateItem(i, "projectNo", e.target.value)}
                    style={{ ...cellInput, textAlign: "center" }}
                  />
                </td>
                <td style={td}>
                  <input
                    type="number"
                    value={it.amount}
                    onChange={(e) => updateItem(i, "amount", e.target.value)}
                    className="no-spin"
                    style={{ ...cellInput, textAlign: "right" }}
                  />
                </td>
              </tr>
              );
            })}
            {/* Blank filler rows (see effectiveFillerCounts above) — same
                column count/border/width as a real row (one <td> per
                colgroup column, td's border+padding), and the รายการ cell
                reuses the exact same auto-growing textarea markup as a
                real row so its height matches a real blank row exactly.
                Not part of draft.items, but not a dead end either —
                focusing it promotes it into a real row, same as
                FA017Form's identical filler row; see its comment for the
                full rationale. */}
            {Array.from({ length: effectiveFillerCounts[pageIndex] ?? 0 }, (_, fillerIdx) => (
              <tr
                key={`filler-${fillerIdx}`}
                ref={pageIndex === probeFillerPageIndex && fillerIdx === 0 ? probeFillerRowRef : undefined}
              >
                {COL_PCT.map((_, colIdx) =>
                  colIdx === 1 ? (
                    <td key={colIdx} style={td}>
                      <textarea
                        ref={(el) => {
                          if (el) {
                            el.style.height = "auto";
                            el.style.height = `${el.scrollHeight}px`;
                          }
                        }}
                        className="desc-textarea"
                        value=""
                        readOnly
                        onFocus={() => {
                          pendingFocusIndexRef.current = items.length;
                          addRow();
                        }}
                        rows={1}
                        style={{ ...cellInput, resize: "none", overflow: "hidden", whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.3 }}
                      />
                    </td>
                  ) : (
                    <td key={colIdx} style={td} />
                  )
                )}
              </tr>
            ))}
          </tbody>
          {/* Only the last page — see this component's doc comment and
              renderPage's isLastPage. totalsTbodyRef attaches here (not
              page 0) since this is the only page it ever mounts on. */}
          {isLastPage && (
            <tbody ref={totalsTbodyRef}>
              <tr>
                <td colSpan={3} style={{ ...th, textAlign: "center", fontWeight: 700 }}>
                  รวม
                </td>
                <td style={{ ...th, textAlign: "right", fontWeight: 700 }}>{grandTotal}</td>
              </tr>
            </tbody>
          )}
        </table>

        <div>
          {/* keep-together (globals.css): print-only break-inside: avoid.
              remeasure()'s pagination already fits this whole block (plus
              its rows) within PAGE_HEIGHT_BUDGET_FA018 on every page, so
              this is a safety net rather than the normal case — see
              FA017Form's identical comment for the sub-pixel-rounding
              rationale. Rendered on every page, each needing its own actual
              signatures — see this component's doc comment. */}
          <div className="keep-together">
            <div style={{ marginTop: 18, fontSize: 12, lineHeight: 1.7 }}>
              <div>ข้าพเจ้าขอรับรองว่ารายจ่ายข้างต้นนี้ ไม่อาจเรียกใบเสร็จรับเงินจากผู้รับได้ และข้าพเจ้าได้จ่ายไปในงาน</div>
              <div>ของทางบริษัท อินฟอร์เมชั่น แอนด์ คอมมิวนิเคชั่น เน็ทเวิร์คส จำกัด (มหาชน) โดยแท้</div>
            </div>

            {/* gridTemplateColumns reuses the item table's own column widths
                (colTemplate) instead of an even 1fr/1fr split, so each block sits
                exactly inside the column frame it's meant to line up with:
                ผู้ขอเบิก under "รายการ", ผู้อนุมัติ under "เลขที่โครงการ" — per
                request. วันที่ and จำนวนเงิน (columns 1 and 4) are left empty on
                purpose, giving the same left/right margins the table above has. */}
            <div style={{ display: "grid", gridTemplateColumns: colTemplate, marginTop: 52, fontSize: 13 }}>
              <div style={{ gridColumn: "2 / 3" }}>
                <div>ผู้ขอเบิก&nbsp;&nbsp;&nbsp;&nbsp;……………………………….</div>
                <div style={{ marginTop: 26 }}>วันที่&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;……………………………….</div>
              </div>
              {/* "เลขที่โครงการ" (column 3) is only 16% wide — narrower than the
                  old even 1fr/1fr split — so these lines are left free to
                  overflow rightward past its frame rather than word-wrapping
                  awkwardly mid-label; the block's *start* is what's meant to line
                  up with the column, not its full width. */}
              <div style={{ gridColumn: "3 / 4", whiteSpace: "nowrap" }}>
                <div>ผู้อนุมัติ&nbsp;&nbsp;&nbsp;&nbsp;..........................................</div>
                <div style={{ marginTop: 26 }}>วันที่&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;..........................................</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Sits above the .paper stack, not inside it — a sibling rather than
          a child of the measured page means it never counts toward
          remeasure()'s headerHeight delta (which is read against
          firstPageRef's own bounds), so this screen-only control can't
          accidentally push the form onto an extra page just because it
          takes up screen space. `.no-print` still hides it from the actual
          printed/PDF output too, same belt-and-suspenders as everywhere
          else in this app. */}
      <div className="no-print" style={{ maxWidth: PAPER_WIDTH_FA018, margin: "0 auto 8px" }}>
        <SavedListManager
          label="รายการที่บันทึกไว้"
          items={savedItemList.map((entry) => ({ id: entry.id, text: entry.desc }))}
          onDelete={removeSavedItem}
        />
      </div>
      {effectivePages.map((idxs, pageIndex) => renderPage(idxs, pageIndex))}
      <ConfirmDialog
        open={pendingSaveRow !== null}
        title="ยืนยันการบันทึกไว้ใช้ซ้ำ"
        message={
          pendingSaveRow !== null && findSavedItem(items[pendingSaveRow].desc)
            ? "มีรายการที่บันทึกไว้แล้วชื่อนี้อยู่ — บันทึกซ้ำจะเขียนทับข้อมูลเดิม ต้องการดำเนินการต่อหรือไม่?"
            : "บันทึกรายการนี้ไว้ใช้ซ้ำในครั้งหน้าหรือไม่?"
        }
        confirmLabel="บันทึก"
        onConfirm={confirmSaveRow}
        onCancel={() => setPendingSaveRow(null)}
      />
    </>
  );
}
