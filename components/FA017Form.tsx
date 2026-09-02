"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";
import {
  MONTH_OPTIONS,
  PAGE_HEIGHT_BUDGET_FA017,
  PAPER_PADDING_FA017,
  PAPER_WIDTH_FA017,
  SHOW_PROJECT_FIELD,
  TABLE_FONT_SIZE,
} from "@/lib/constants";
import { fmt, joinDMY, num, splitDMY } from "@/lib/format";
import { computeFillerCounts, computePageBreaks, ensureLastPageHasContent, fillerCountsEqual, pageBreaksEqual } from "@/lib/pagination";
import { fa017RowTotal, fa017Totals } from "@/lib/totals";
import { isFA017ItemEmpty } from "@/lib/types";
import type { Draft, EmployeeSnapshot, FA017Item, ItemField, SavedItemEntry } from "@/lib/types";
import { useSavedItems } from "@/lib/useSavedItems";
import ConfirmDialog from "@/components/ConfirmDialog";
import SavedListManager from "@/components/SavedListManager";

// fontSize is smaller than the table's base 12px specifically for headers:
// several real columns (Entertain, Mobile, Hotel, Other...) are only ~4.2%
// wide (~45px) — single words with no natural break point, so at the base
// size they overflow into the next header instead of wrapping.
// verticalAlign: "top" so every header lines up along the same top edge —
// without it, cells default to middle-aligned, and the tallest headers
// push short single-line ones down to a different vertical position
// instead of a shared line. whiteSpace: "nowrap" forces every header onto
// one line.
const th: React.CSSProperties = { border: "1px solid #000", padding: "4px 2px", fontSize: 11, lineHeight: 1.2, verticalAlign: "top", whiteSpace: "nowrap" };
// The Receipt..Other 8 headers are equal-width columns (see COL_PCT),
// each ~7.77-7.78% (~81px of content room) after Description was cut
// further to fund this span. Matching the header row's base 10px is
// mathematically impossible at equal width without leaving Description
// almost no room at all — so this group instead uses a dedicated size.
// 7.25px measured as "fits" using the browser's own scrollWidth check,
// but that check rounds to whole pixels and hid a real (if sub-pixel)
// overflow on "Transport & Express way", the longest label — measuring
// the actual text run against the cell's content box (fractional px, no
// rounding) showed it was genuinely wider than the box at 7.25px and
// only clears it with margin at 6.75px, which is what's used here.
const thExpenseHead: React.CSSProperties = { ...th, fontSize: 11 };
const thDescriptionHead: React.CSSProperties = { ...th, fontSize: 12, textAlign: "center" };
const thLocalCurrencyHead: React.CSSProperties = { ...th, fontSize: 11 };
// Vertical padding trimmed to hug the label text more tightly (was 5px,
// leaving a visibly taller box than the text needed). Horizontal padding
// and every column's width (colgroup, shared with the table below) are
// untouched, so the vertical grid lines stay exactly where they were —
// only the row's height shrinks.
const infoTd: React.CSSProperties = { border: "1px solid #000", padding: "2px 8px" };
// "DATE :" and "EMPLOYEE NO :" share col10 with "Local Currency Amount"
// (same colgroup as the item table below) — narrowing that column to
// widen Expense meant dropping these two off the info table's base 12px
// to fit, matching the item header row's 10px instead of a size unique
// to just these two cells.
const infoTdNarrowCol: React.CSSProperties = { ...infoTd, fontSize: 10 };
// verticalAlign:middle centres a single-line value in a row made taller by
// a multi-line Description beside it; the 3px top/bottom padding keeps text
// (Thai upper vowel marks especially) off the cell's borders.
const cellTd: React.CSSProperties = { border: "1px solid #000", padding: "3px 3px", verticalAlign: "middle" };
// Spacer rows around Total: same bordered grid as every other row (one <td>
// per column, so the vertical lines still line up with the columns above),
// but padding/line-height stripped and height pinned to 4px so the row
// itself reads as a thin divider rather than a normal data row.
const spacerTd: React.CSSProperties = { border: "1px solid #000", padding: 0, height: 10, lineHeight: 0, fontSize: 1 };

// display:block (not the inline-block an <input>/<textarea> is by default)
// so the cell's verticalAlign:middle actually centres it — an inline
// control sits on the text baseline instead and rides up against the top
// border in a tall row.
const cellInput = (align?: "right" | "center"): React.CSSProperties => ({
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  border: "none",
  font: "inherit",
  background: "transparent",
  fontSize: TABLE_FONT_SIZE,
  textAlign: align,
});

// Layered onto cellInput for the per-row Project/CC + amount cells, which
// are <textarea>s (not one-line <input>s) so a value wider than the narrow
// column wraps onto a second line and grows the row instead of the digits
// being clipped or scrolling out of view. Same wrap/no-resize/no-scrollbar
// treatment the Description textarea already uses.
const cellTextareaWrap: React.CSSProperties = {
  resize: "none",
  overflow: "hidden",
  whiteSpace: "normal",
  wordBreak: "break-word",
  lineHeight: 1.3,
};

// Total row's amount cells: same as their inline style was, plus wordBreak
// so a grand total too wide for its column wraps rather than overflowing
// the box (fmt()'s thousands separators are not break opportunities on
// their own).
const totalNumTd: React.CSSProperties = { border: "1px solid #000", padding: 5, textAlign: "right", wordBreak: "break-word" };

// Column widths measured directly from the real F-FA-017 workbook (Excel
// column-width units, converted to % of the 217.52-unit total) — replaces
// earlier guesses made by eyeballing a compressed PDF render, which is what
// forced a series of workarounds (merged DATE/EMPLOYEE NO cells, a
// hand-rolled CSS divider, a height:1px hack) to fake alignment that real
// <td> columns give for free once the proportions are actually correct.
// Order: Date, Description, Receipt, Project/CC, Gasoline, Hotel, Entertain,
// Mobile, Transport & Express way, Other, Local Currency Amount, Thai Baht Total.
//
// The Receipt..Other 8 columns (indices 2-9) are equal width, ~8.25-8.26
// each. "Transport & Express way" and "Local Currency Amount" (index 10)
// now wrap onto a fixed 2 lines (see the <br /> in the header row below)
// instead of forcing one line, which shrinks their own width need to
// just their longer word/phrase — freeing col10 (DATE:/EMPLOYEE NO:/
// Local Currency Amount, all sharing the same colgroup column) and col11
// (Thai Baht Total, 9.74 -> 7.50) to shrink, and handing that 3.85 total
// to this 8-column span (62.21 -> 66.06) so its header font can go back
// up to the header row's base 10px instead of a dedicated smaller size.
//
// Description (index 1) was widened from 10.00 to 33.00 so the fixed
// "Office :" value — the full company name, one line, no longer editable
// (see the Office cell below) — fits without wrapping. It was then cut by
// 15% (33.00 -> 28.05, still comfortable for the one-line company name)
// and the freed 4.95 points funded two more single-line fits: Local
// Currency Amount/EMPLOYEE NO :/DATE: (index 10, 6.00 -> 9.45 — that
// column's "EMPLOYEE NO :" label was clipping) and Thai Baht Total
// (index 11, 7.24 -> 8.74 — wide enough to drop its forced 2-line wrap
// back to one line; see the header row below).
//
// Receipt (index 2) was then pulled off the equal-width Receipt..Other
// group (each was ~5.73%) and widened again, 5.73 -> 8.53, to fit "Receipt
// (Yes/No)" on one line at the header row's 9px — the 2.80 that funds it
// is cut from Description (28.05 -> 25.25, still fits the one-line company
// name). Gasoline through Other (indices 3-9) stay at the original ~5.7%
// each. Date (index 0) was widened 7.94 -> 10.44 (the 2.50 taken from
// Description, 25.25 -> 22.75, which still comfortably fits the one-line
// company name) so its live day/month/year control can carry a legible
// font size instead of the cramped 8px it needed at the old width.
// Project/CC (index 3) and Transport & Express way (index 8) each widened
// +1.00 so the header row can carry a legible ~11px font without the
// longest labels ("Project / CC", "Express way") overflowing their column;
// the 2.00 comes off Local Currency Amount (index 10, -1.30) and Thai Baht
// Total (index 11, -0.70), both of which still hold their own headers with
// room to spare at that size.
const COL_PCT = SHOW_PROJECT_FIELD
  ? [10.44, 22.75, 8.53, 6.73, 5.73, 5.73, 5.73, 5.73, 6.72, 5.72, 8.15, 8.04]
  : [10.44, 24.87, 10.91, 8.61, 4.22, 4.22, 4.22, 4.22, 4.22, 10.11, 9.74]; // Project/CC's 4.22% just dropped (this branch isn't used anywhere in the app today)

// The Excel source's "Description" column is actually two real columns (B
// and C) merged together everywhere EXCEPT the top two signature boxes,
// which merge only A:B (i.e. Date + just the B part of Description). This
// finer breakdown is only needed for those two boxes' widths/gap below.
// The 4.15/5.85 split (originally summing to Description's 10.00, then to
// 33.00) is scaled the same way to Description's current 25.25, and the
// tail mirrors COL_PCT's indices 2-11 so both tables' columns still align.
const SIG_COL_PCT = [10.44, 10.48, 12.27, 8.53, 6.73, 5.73, 5.73, 5.73, 5.73, 6.72, 5.72, 8.15, 8.04];

// The per-row Date column used to be a native <input type="date">, whose
// picker/format follows the browser's locale (often mm/dd/yyyy) and whose
// widget chrome (calendar icon, segment separators) doesn't fit this
// column's ~78px content width — it clipped. Swapped for the same
// day/month/year triple used by the DATE: control above, which lets the
// order be pinned to dd/mm/yyyy and every input's width tuned to actually
// fit. See lib/format.ts's splitDMY/joinDMY (shared with FA018Form, which
// hit an analogous native <input type="date"> problem later) for the
// split/join rationale.

// A freshly-added row has every field blank, but fmt(fa017RowTotal(it))
// still prints "-" (fmt's zero-amount marker) into its Thai Baht Total
// cell — the only visible mark on an otherwise untouched row. Rows the
// user hasn't typed anything into at all should read as fully blank
// (still gridded, just no text) rather than showing that stray "-".
// isFA017ItemEmpty now lives in lib/types.ts, shared with the entry-form
// components (finding the first blank row to prefill).

// One <td> per column (matches the colgroup) so the vertical grid lines
// stay aligned with every other row — just a bordered, empty, 4px-tall
// divider rather than a merged/colSpan block.
function SpacerRow({ cols }: { cols: number }) {
  return (
    <tr style={{ height: 4 }}>
      {Array.from({ length: cols }, (_, i) => (
        <td key={i} style={spacerTd} />
      ))}
    </tr>
  );
}

interface FA017FormProps {
  draft: Draft;
  setEmpField: (field: keyof EmployeeSnapshot, value: string) => void;
  setMonthName: (value: string) => void;
  setMonthYear: (value: number) => void;
  setDay: (value: number) => void;
  setRemark: (value: string) => void;
  updateItem: (i: number, field: ItemField, value: string) => void;
  savedItems: SavedItemEntry[];
  // Appends a real blank item to draft.items — same action as
  // EditorToolbar's "+ เพิ่มแถว" button, reused here so focusing a blank
  // filler row (see the filler-row block in renderPage below) promotes it
  // into a real, editable row instead of leaving the click dead.
  addRow: () => void;
}

// Screen-only "save this row" icon — see the Description <td>'s comment
// below for why it's absolutely positioned rather than its own table
// column. Kept deliberately subtle (low opacity at rest) so it doesn't
// visually compete with the actual description text; `.no-print`
// (globals.css) removes it from the printed/PDF output entirely, so it has
// zero effect on the form's pixel-perfect print fidelity.
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

// Ported from the `isFA017` sc-if block in the design source: landscape
// Employee Expense Claim paper — header fields, multi-column expense table,
// totals, certification, signature grid. Column proportions and every
// section below the table are measured from the real F-FA-017 Excel
// workbook (see COL_PCT / SIG_COL_PCT above), not from dc.html.
//
// Pagination: no cap on how many rows "+ เพิ่มแถว" can add — every render
// checks the actual rendered page height against PAGE_HEIGHT_BUDGET_FA017
// and, when it's over (easily reached in normal use: Description is an
// auto-growing <textarea> below, so even a couple of wrapped descriptions
// push a page well past budget), falls back to splitting rows across
// multiple ".paper" sheets, packing as many as actually fit per page (see
// lib/pagination.ts) — not a fixed count. Every page repeats the full
// header, but only the LAST page carries the Total row: earlier pages end
// right after their own rows, and the last page's Total is the grand
// total across every page, not just its own — which also means a non-last
// page can fit slightly more rows than the last one, since it doesn't
// need to leave room for that block. Certification/signature stays on
// every page unchanged — except "Total Amount Due to Employee", which
// shows "-" on every non-last page (nothing meaningful to show once that
// page's own Total row is gone) and the same grand total as the Total row
// above it on the last page.
export default function FA017Form({
  draft,
  setEmpField,
  setMonthName,
  setMonthYear,
  setDay,
  setRemark,
  updateItem,
  savedItems,
  addRow,
}: FA017FormProps) {
  const items = draft.items as FA017Item[];
  const totalsColspan = SHOW_PROJECT_FIELD ? 4 : 3;
  // Receipt through Other: 8 columns when the project field is shown, 7 without it.
  const expenseColspan = SHOW_PROJECT_FIELD ? 8 : 7;
  const colTemplate = COL_PCT.map((p) => `${p}%`).join(" ");
  const sigColTemplate = SIG_COL_PCT.map((p) => `${p}%`).join(" ");

  // Save/reuse individual expense rows by their Description text (see
  // lib/useSavedItems.ts) — mirrors EntryFormFA017's identical feature;
  // justSavedRow tracks a brief ✓ flash on the icon button below, keyed by
  // absolute row index since any row can be saved independently.
  const {
    items: savedItemList,
    findMatch: findSavedItem,
    save: saveItemRow,
    remove: removeSavedItem,
  } = useSavedItems("FA017", savedItems);
  const [justSavedRow, setJustSavedRow] = useState<number | null>(null);
  // Row awaiting "ยืนยันการบันทึก" confirmation before the 💾 icon button
  // actually calls saveItemRow — see EntryFormFA017.tsx's identical field
  // for why (saveItemForReuse upserts keyed by Description, so re-saving an
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
  // Only mounted on whichever page is currently last (the Total row now
  // only renders there — see renderPage below), unlike theadRef which is
  // pinned to page 0 since that content is identical on every page.
  const totalsTbodyRef = useRef<HTMLTableSectionElement>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
  // Measures one blank filler row's real rendered height (see
  // computeFillerCounts) — attached to the first filler row of whichever
  // page renders one (probeFillerPageIndex below), since every filler row
  // on every page is visually identical, so a single measurement covers
  // all of them.
  const probeFillerRowRef = useRef<HTMLTableRowElement | null>(null);
  // Set by a filler row's onFocus (below) to the index the newly-appended
  // real item will land at; remeasure() (runs every commit) picks this up
  // as soon as that row actually exists in the DOM and moves focus onto
  // its real textarea — addRow() replaces the filler <tr> the user just
  // clicked with a real one at a new DOM node, which otherwise silently
  // drops focus since the originally-focused element is unmounted.
  const pendingFocusIndexRef = useRef<number | null>(null);
  const [pages, setPages] = useState<number[][] | null>(null);
  // Blank rows appended to each page's own tbody, past its real rows, so a
  // page whose real data doesn't fill its row budget still renders at the
  // same table height as a fully-packed page instead of trailing into
  // blank space above Total/Remark — see lib/pagination.ts's top comment
  // for why this replaced the earlier row-rebalancing approach. Only
  // populated in multi-page mode (see remeasure()); the common single-page
  // case is left exactly as it already was, unpadded.
  const [fillerCounts, setFillerCounts] = useState<number[] | null>(null);
  // Also measured, not hardcoded — see probeFillerRowRef above.
  const [fillerRowHeight, setFillerRowHeight] = useState<number | null>(null);

  // pages is only reconciled by the remeasure() effect below, which runs
  // AFTER render — if draft.items shrinks (removeLastRow in BillEditor) in
  // the same render where pages still reflects the old, longer items array,
  // a stale page would map an out-of-range absolute index into items[i]
  // and get undefined, crashing fa017Totals/fa017RowTotal downstream. Count
  // (not just per-index bounds) is checked since computePageBreaks always
  // partitions exactly [0..items.length-1]: a mismatched total row count is
  // proof pages was computed for a different items.length and must be
  // ignored for this render — the trivial single-page fallback is always
  // safe to render since it derives straight from the current items array.
  const pagesRowCount = pages?.reduce((sum, page) => sum + page.length, 0) ?? -1;
  const effectivePages = pages !== null && pagesRowCount === items.length ? pages : [items.map((_, i) => i)];
  // Same staleness guard as effectivePages above, applied to fillerCounts —
  // one entry per page, so a length mismatch (stale from a different page
  // count) is treated as "not computed yet" rather than indexed into.
  const effectiveFillerCounts =
    fillerCounts !== null && fillerCounts.length === effectivePages.length
      ? fillerCounts
      : effectivePages.map(() => 0);
  const probeFillerPageIndex = effectiveFillerCounts.findIndex((c) => c > 0);

  // The Description textarea's ref callback (below) re-measures scrollHeight
  // on every render, which covers the "actively typing" case fine — each
  // keystroke re-renders, re-measuring against that keystroke's own font
  // metrics. It does NOT cover content that's on screen without any further
  // edit (e.g. opening an existing record to review/print): the very first
  // measurement, taken at mount, can land before next/font's Sarabun face
  // has finished its swap-in (next/font defaults to font-display: swap, so
  // the browser paints with a fallback font first). A long saved
  // description measured against the fallback's metrics can come out
  // shorter than it renders once Sarabun swaps in, and with no further
  // render to re-measure, the row stays pinned at that too-short height —
  // the description's last line then overflows past the cell's bottom
  // border exactly as reported. document.fonts.ready resolves once every
  // face (including the swap) has actually settled, so re-running the same
  // measurement then catches it without waiting on a keystroke that may
  // never come. Iterates rowRefs (rather than a single paper-wide query)
  // since rows may be spread across multiple ".paper" pages; afterwards
  // triggers a pagination remeasure too, since the font swap can itself be
  // what pushes (or stops pushing) a page over budget.
  useLayoutEffect(() => {
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      rowRefs.current.forEach((tr) => {
        tr.querySelectorAll<HTMLTextAreaElement>("textarea.desc-textarea, textarea.amount-textarea").forEach((el) => {
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

  // Two-phase overflow check, re-run after every commit (see the no-deps
  // note below): first, the cheap/accurate path — read the single rendered
  // page's real height directly and compare to budget. Only when that's
  // over budget do we fall back to the decomposed header/row/tail
  // measurements (border-collapse tables can make summed parts drift a few
  // px from the whole, hence the safety margin) to decide where to split.
  function remeasure() {
    // See pendingFocusIndexRef's declaration above — promoting a filler row
    // (onFocus, below) replaces its DOM node with a real row's on the very
    // next commit, so this fires here rather than in the onFocus handler
    // itself, which would be reading a ref that hasn't mounted yet. The
    // promoted row can actually remount *twice*: once when the stale-pages
    // guard (effectivePages above) falls back to a single "mega page"
    // holding every item because `pages` hasn't caught up to the new
    // items.length yet, and again once this same call below recomputes the
    // real split and the row moves into its true page's own tbody — each
    // remount drops focus back to <body> (removing the focused node from
    // the DOM does that synchronously), so this only stops re-applying
    // focus once the render it's looking at is the *settled* one (pages
    // already matching items.length — a null pages is always already
    // settled, since the trivial single-page fallback it implies is
    // never wrong, only ever a real, final page). Gating re-focus on
    // "focus is currently sitting on <body>" (rather than unconditionally
    // refocusing every commit) is what stops this from ever yanking focus
    // away from something the user legitimately focused afterward.
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
      if (h <= PAGE_HEIGHT_BUDGET_FA017) {
        if (pages !== null) setPages(null);
        if (fillerCounts !== null) setFillerCounts(null);
        return;
      }
    }
    // Measured as deltas between real rendered edges, not by summing each
    // piece's own getBoundingClientRect().height — summing independent
    // pieces silently drops .paper's own top/bottom padding (belongs to no
    // single child). Deltas against the owning .paper's actual top/bottom
    // account for that for free, since they're just "how far apart these two
    // real points are" rather than a sum that has to know about every
    // padding rule in between. theadRef always lives on page 0 (every page
    // repeats the same header, so measuring it from any one page is
    // representative of all of them), hence the delta is read against
    // firstPageRef.
    const headerHeight = theadRef.current
      ? theadRef.current.getBoundingClientRect().bottom - (firstPageRef.current?.getBoundingClientRect().top ?? 0)
      : 0;
    // Content only (excludes .paper's own bottom padding, already baked
    // into the paper.bottom - itemsTable.bottom delta below) — that reserve
    // is folded into budgetPx instead, applied once per page uniformly, and
    // must not be counted twice here. This is the part every page pays
    // regardless of last/non-last — the Total row (measured separately
    // below) is extra, paid only by whichever page is last.
    //
    // Measured from the item <table>'s own bottom edge (found via
    // theadRef's ancestor, rather than a dedicated ref) rather than from the
    // Remark block's wrapper div — that wrapper has no border/padding of its
    // own, so its inner content's marginTop collapses straight through it,
    // pushing the wrapper's own measured top down without that margin ever
    // showing up in any element's height. A delta measured *from* the
    // wrapper's top silently drops that margin (confirmed against the real
    // rendered DOM: an 8px gap between the table and the wrapper that no
    // other quantity here accounted for), letting one row too many get
    // packed onto a page before it visibly overflows past A4. The table's
    // bottom edge has no such collapsed margin above it, so measuring from
    // there instead captures the true distance with nothing lost.
    const itemsTable = theadRef.current?.closest("table") ?? null;
    const recurringTailHeight = itemsTable
      ? (firstPageRef.current?.getBoundingClientRect().bottom ?? 0) - itemsTable.getBoundingClientRect().bottom - PAPER_PADDING_FA017
      : 0;
    // The Total row block's own height alone (not a delta) — only the last
    // page pays this, reserved separately per page in computePageBreaks.
    const lastPageExtraHeight = totalsTbodyRef.current?.getBoundingClientRect().height ?? 0;
    const rowHeights = items.map((_, i) => rowRefs.current.get(i)?.getBoundingClientRect().height ?? 0);
    // PAPER_PADDING_FA017 reserves every page's own bottom padding (see
    // recurringTailHeight's comment above) — without it, a page's
    // header+rows alone could measure as "fits" while ignoring the padding
    // still due before the true physical edge. The extra 2px is a small
    // safety margin for sub-pixel rounding. Shared with computeFillerCounts
    // below so blank rows are padded against the exact same per-page budget
    // real rows were packed against.
    const budgetPx = PAGE_HEIGHT_BUDGET_FA017 - PAPER_PADDING_FA017 - 2;
    const rawNext = computePageBreaks({ headerHeight, recurringTailHeight, lastPageExtraHeight, rowHeights, budgetPx });
    const isTrivial = rawNext.length === 1 && rawNext[0].length === items.length;
    if (isTrivial) {
      if (pages !== null) setPages(null);
      if (fillerCounts !== null) setFillerCounts(null);
      return;
    }
    // A spillover page holding only blank/padding rows reads as an empty
    // extra sheet with nothing but Total on it — pull the previous page's
    // last row over too so it shows real content instead (see this
    // function's own doc comment in lib/pagination.ts).
    const next = ensureLastPageHasContent(rawNext, (i) => isFA017ItemEmpty(items[i]));
    if (pages === null || !pageBreaksEqual(pages, next)) {
      setPages(next);
    }

    // Multi-page only (the isTrivial return above already handled the
    // single-page case, left unpadded) — pad each page's leftover space
    // with blank filler rows. Non-last pages are already packed to near
    // capacity by computePageBreaks, so this is mainly the last page in
    // practice, but computing it uniformly needs no special-casing (a
    // fully-packed page's own remaining space is already ~0).
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
    // Learn the real height of a blank filler row from whatever probe row
    // is currently on screen (rendered by the previous commit, per
    // probeFillerPageIndex) — refines the initial 1-row probe guess into an
    // exact per-page count on the next pass, same idempotent convergence
    // pattern as pages/rowHeights above.
    if (probeFillerRowRef.current) {
      const measured = probeFillerRowRef.current.getBoundingClientRect().height;
      if (measured > 0 && (fillerRowHeight === null || Math.abs(fillerRowHeight - measured) > 0.5)) {
        setFillerRowHeight(measured);
      }
    }
  }

  // No dependency array, deliberately: the body is idempotent (always
  // compares the freshly computed result against current state and only
  // calls setPages when it actually differs), so re-running it after every
  // commit is safe — a no-op result never triggers another render, so this
  // converges rather than looping. Cheap too: a getBoundingClientRect() read
  // per item row at most, since there's no upper bound on row count anymore.
  // useLayoutEffect flushes before paint, so a page that needs to split
  // never flashes an overflowing single page first. This also sidesteps a
  // dependency list that would otherwise need every field that can affect
  // rendered height (items, employee, remark, day, monthName, monthYear).
  useLayoutEffect(() => {
    remeasure();
  });

  // Re-measure a wrapping cell <textarea> and pin its height to the
  // content: a value that wraps past one line grows the row to fit, a
  // value that stops wrapping shrinks it back. Re-created every render so
  // its ref identity changes every render, which is what makes React
  // re-run it on mount *and* on every keystroke — same trick, and same
  // reason, as the Description textarea's inline ref below.
  const measureCellTextarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  // Shared props for the per-row Project/CC + amount cells. All are
  // auto-growing <textarea>s (see cellTextareaWrap) so a value wider than
  // the column wraps onto a new line instead of being clipped; Enter is
  // swallowed so the field can never gain a literal newline of its own.
  function wrapCellProps(i: number, field: ItemField, value: string) {
    return {
      ref: measureCellTextarea,
      className: "amount-textarea",
      rows: 1,
      value,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => updateItem(i, field, e.target.value),
      onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter") e.preventDefault();
      },
    };
  }

  // wrapCellProps plus the numeric behavior of the 7 amount fields
  // (Gasoline..Local Currency Amount): snap the value to 2 decimals on
  // blur (only when non-empty — an untouched cell stays blank rather than
  // turning into "0.00"), and clear the field on focus if it's showing
  // zero so typing a fresh number doesn't start by prefixing onto a "0".
  // inputMode keeps a numeric keypad on mobile now that there's no
  // type="number" (a <textarea> has none); num() already does all parsing.
  function amountFieldProps(i: number, field: ItemField, value: string) {
    return {
      ...wrapCellProps(i, field, value),
      inputMode: "decimal" as const,
      onFocus: (e: React.FocusEvent<HTMLTextAreaElement>) => {
        if (e.target.value !== "" && num(e.target.value) === 0) updateItem(i, field, "");
      },
      onBlur: (e: React.FocusEvent<HTMLTextAreaElement>) => {
        if (e.target.value !== "") updateItem(i, field, num(e.target.value).toFixed(2));
      },
    };
  }

  function renderPage(pageIndices: number[], pageIndex: number) {
    // Only the last page carries the Total row (see this component's doc
    // comment) — and when it does, it's the grand total across every
    // page's rows (fa017Totals accepts any array, so the full items array
    // works as-is), not just this page's own slice.
    const isLastPage = pageIndex === effectivePages.length - 1;
    const grandTotals = fa017Totals(items);
    return (
      <div
        key={pageIndex}
        ref={pageIndex === 0 ? firstPageRef : undefined}
        className="paper"
        style={{
          width: PAPER_WIDTH_FA017,
          padding: `${PAPER_PADDING_FA017}px 30px`,
          fontSize: TABLE_FONT_SIZE,
        }}
      >
        <div>
          {/* "F-FA-017" moved to its own line above the logo/title row (per
              request) rather than sharing it as a third grid column. The
              grid below keeps that same third (90px) column, now empty, so
              its width still balances the 90px logo column and the title
              stays centered exactly as before. */}
          <div style={{ textAlign: "right", fontSize: 12, color: "#555" }}>
            F-FA-017
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "90px 1fr 90px",
              alignItems: "center",
              padding: "6px 0",
            }}
          >
            <Image
              src="/icn-logo.png"
              alt="ICN"
              height={40}
              width={170}
              style={{ height: 40, width: "auto", justifySelf: "start" }}
            />
            <div style={{ textAlign: "center", fontWeight: 700, fontSize: 17 }}>
              Employee Expense Claim
            </div>
            <div />
          </div>

          {/* Same 12-column colgroup as the expense table below, so every
              vertical line here lands on exactly the same x-position as that
              table's column boundaries — no merging or CSS hacks needed now
              that the percentages themselves are correct. */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" }}>
            <colgroup>
              {COL_PCT.map((p, i) => (
                <col key={i} style={{ width: `${p}%` }} />
              ))}
            </colgroup>
            <tbody>
              <tr>
                <td style={{ ...infoTd, whiteSpace: "nowrap", textAlign: "center" }}>Name :</td>
                <td style={infoTd}>
                  <input
                    value={draft.employee.name}
                    onChange={(e) => setEmpField("name", e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", border: "none", background: "transparent", font: "inherit", textAlign: "center" }}
                  />
                </td>
                {/* Real form merges D4:K5 — Receipt through Other (8 columns),
                    not Project/CC through Other. */}
                <td
                  colSpan={expenseColspan}
                  rowSpan={2}
                  style={{ ...infoTd, textAlign: "center", fontWeight: 700, fontSize: 15, verticalAlign: "middle" }}
                >
                  Expense
                </td>
                <td style={{ ...infoTdNarrowCol, whiteSpace: "nowrap", textAlign: "right" }}>DATE :</td>
                <td style={infoTd}>
                  {/* Thai Baht Total's column is only ~9.74% wide (~87px net of
                      padding) — correct per the real form, but that column was
                      never meant to hold 3 live input controls (the real form
                      just prints a static date string there). Now that month is
                      a short 1-12 number instead of a full Thai month name, all
                      three fields fit on one line. The no-spin/no-arrow classes
                      (globals.css) strip native spin/dropdown arrows so the
                      digits themselves aren't clipped in this tight width.
                      Borderless on purpose (matches the real form, which just
                      prints a plain "d/m/y" string here with no box) — the
                      print-only override in globals.css that used to add this
                      is now redundant but left in place as a harmless safety
                      net. None of these controls change size, so the table grid
                      this column shares with the row below stays untouched.
                      fontSize 12 (not a smaller dedicated size) matches Name/
                      Employee No's font in this same info table — with
                      no-spin/no-arrow already reclaiming the native
                      spinner/dropdown-arrow chrome's width, even the widest
                      realistic value ("31 / 12 / 2569") still fits this
                      column with room to spare (verified by rendering this
                      exact markup headlessly at that width before changing
                      it here). */}
                  <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={draft.day}
                      onChange={(e) => setDay(Number(e.target.value))}
                      className="no-spin date-field"
                      style={{ width: 18, boxSizing: "border-box", border: "none", background: "transparent", font: "inherit", fontSize: 12, padding: 1, textAlign: "center" }}
                    />
                    <span style={{ fontSize: 14 }}>/</span>
                    <select
                      value={draft.monthName}
                      onChange={(e) => setMonthName(e.target.value)}
                      className="no-arrow date-field"
                      style={{ width: 26, boxSizing: "border-box", border: "none", background: "transparent", font: "inherit", fontSize: 12, padding: 1, textAlign: "center" }}
                    >
                      {MONTH_OPTIONS.map((mo) => (
                        <option key={mo.value} value={mo.value}>
                          {mo.label}
                        </option>
                      ))}
                    </select>
                    <span style={{ fontSize: 12 }}>/</span>
                    <input
                      type="number"
                      value={draft.monthYear}
                      onChange={(e) => setMonthYear(Number(e.target.value))}
                      className="no-spin date-field"
                      style={{ flex: 1, minWidth: 32, boxSizing: "border-box", border: "none", background: "transparent", font: "inherit", fontSize: 12, padding: 1, textAlign: "center" }}
                    />
                  </div>
                </td>
              </tr>
              <tr>
                <td style={{ ...infoTd, whiteSpace: "nowrap", textAlign: "center" }}>Office :</td>
                <td style={{ ...infoTd, whiteSpace: "nowrap", fontSize: 8, textAlign: "center" }}>
                  บริษัท อินฟอร์เมชั่น แอนด์ คอมมิวนิเคชั่น เน็ทเวิร์คส จำกัด (มหาชน)
                </td>
                <td style={{ ...infoTdNarrowCol, whiteSpace: "nowrap", textAlign: "right" }}>EMPLOYEE NO :</td>
                <td style={infoTd}>
                  <input
                    value={draft.employee.employeeNo}
                    onChange={(e) => setEmpField("employeeNo", e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", border: "none", background: "transparent", font: "inherit", textAlign: "center" }}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: -1, tableLayout: "fixed" }}>
          <colgroup>
            {COL_PCT.map((p, i) => (
              <col key={i} style={{ width: `${p}%` }} />
            ))}
          </colgroup>
          <thead ref={pageIndex === 0 ? theadRef : undefined}>
            <tr>
              {/* Explicit center + 12px rather than relying on th's default
                  center alignment / the shared 10px `th` size — matches
                  "Name :" / "Office :" in the info table directly above,
                  which sit at the outer table's base 12px with no override. */}
              <th style={{ ...th, fontSize: 12, textAlign: "center" }}>Date :</th>
              <th style={thDescriptionHead}>Description of Expenses</th>
              <th style={thExpenseHead}>Receipt (Yes/No)</th>
              {SHOW_PROJECT_FIELD && <th style={thExpenseHead}>Project / CC</th>}
              <th style={thExpenseHead}>Gasoline</th>
              <th style={thExpenseHead}>Hotel</th>
              <th style={thExpenseHead}>Entertain</th>
              <th style={thExpenseHead}>Mobile</th>
              <th style={thExpenseHead}>Transport &amp;<br />Express way</th>
              <th style={thExpenseHead}>Other</th>
              <th style={thLocalCurrencyHead}>Local Currency<br />Amount</th>
              <th style={th}>Thai Baht Total</th>
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
                <td style={cellTd}>
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
                      style={{ width: 20, boxSizing: "border-box", border: "none", background: "transparent", font: "inherit", fontSize: 11, padding: 0, textAlign: "center" }}
                    />
                    {(d || m || y) && <span style={{ fontSize: 11 }}>/</span>}
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={m}
                      onChange={(e) => updateItem(i, "date", joinDMY(d, e.target.value, y))}
                      className="no-spin"
                      style={{ width: 20, boxSizing: "border-box", border: "none", background: "transparent", font: "inherit", fontSize: 11, padding: 0, textAlign: "center" }}
                    />
                    {(d || m || y) && <span style={{ fontSize: 11 }}>/</span>}
                    <input
                      type="number"
                      value={y}
                      onChange={(e) => updateItem(i, "date", joinDMY(d, m, e.target.value))}
                      className="no-spin"
                      style={{ width: 34, boxSizing: "border-box", border: "none", background: "transparent", font: "inherit", fontSize: 11, padding: 0, textAlign: "center" }}
                    />
                  </div>
                </td>
                <td style={{ ...cellTd, position: "relative" }}>
                  {/* A plain rows={1} textarea doesn't grow with wrapped
                      content — Chrome scrolls it internally instead of
                      expanding the row. This ref re-measures scrollHeight on
                      every render (mount and each keystroke alike, since the
                      inline callback identity changes every render) and pins
                      the textarea's own height to it, so the row grows to
                      fit whenever the description wraps past one line. The
                      font-ready effect above re-runs this same measurement
                      for content that's on screen without any edit of its
                      own to trigger a re-render — see that effect's comment.
                      className is just a selector for it, not styled. */}
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
                    style={{ ...cellInput(), resize: "none", overflow: "hidden", whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.3 }}
                  />
                  {/* Screen-only "pick a saved row" control — a plain
                      <input list=…>/<datalist> pair (used everywhere else
                      in the app for this exact "type or pick a saved key"
                      interaction) isn't an option here since HTML's `list`
                      attribute only works on <input>, not <textarea>
                      (needed above for auto-growing Description). A native
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
                <td style={{ ...cellTd, textAlign: "center" }}>
                  {/* .no-arrow (globals.css) strips the native <select>'s
                      dropdown-arrow chrome — same class the DATE: month
                      select above already uses. Without it, the arrow shows
                      up in every row regardless of value, so an unanswered
                      Receipt cell never actually reads as blank even though
                      its selected option text is empty. */}
                  <select
                    value={it.receipt}
                    onChange={(e) => updateItem(i, "receipt", e.target.value)}
                    className="no-arrow"
                    style={{ border: "none", background: "transparent", font: "inherit", fontSize: TABLE_FONT_SIZE, textAlign: "center", verticalAlign: "middle" }}
                  >
                    <option value=""></option>
                    <option value="Y">Yes</option>
                    <option value="N">No</option>
                  </select>
                </td>
                {SHOW_PROJECT_FIELD && (
                  <td style={cellTd}>
                    <textarea {...wrapCellProps(i, "projectCC", it.projectCC)} style={{ ...cellInput("center"), ...cellTextareaWrap }} />
                  </td>
                )}
                <td style={cellTd}>
                  <textarea {...amountFieldProps(i, "gasoline", it.gasoline)} style={{ ...cellInput("right"), ...cellTextareaWrap }} />
                </td>
                <td style={cellTd}>
                  <textarea {...amountFieldProps(i, "hotel", it.hotel)} style={{ ...cellInput("right"), ...cellTextareaWrap }} />
                </td>
                <td style={cellTd}>
                  <textarea {...amountFieldProps(i, "entertain", it.entertain)} style={{ ...cellInput("right"), ...cellTextareaWrap }} />
                </td>
                <td style={cellTd}>
                  <textarea {...amountFieldProps(i, "mobile", it.mobile)} style={{ ...cellInput("right"), ...cellTextareaWrap }} />
                </td>
                <td style={cellTd}>
                  <textarea {...amountFieldProps(i, "transport", it.transport)} style={{ ...cellInput("right"), ...cellTextareaWrap }} />
                </td>
                <td style={cellTd}>
                  <textarea {...amountFieldProps(i, "other", it.other)} style={{ ...cellInput("right"), ...cellTextareaWrap }} />
                </td>
                <td style={cellTd}>
                  <textarea {...amountFieldProps(i, "localAmt", it.localAmt)} style={{ ...cellInput("right"), ...cellTextareaWrap }} />
                </td>
                <td style={{ ...cellTd, textAlign: "right", fontWeight: 600, wordBreak: "break-word" }}>
                  {isFA017ItemEmpty(it) ? "" : fmt(fa017RowTotal(it))}
                </td>
              </tr>
              );
            })}
            {/* Blank filler rows (see effectiveFillerCounts above) — same
                column count/border/width as a real row (one <td> per
                colgroup column, cellTd's border+padding), and the
                Description cell reuses the exact same auto-growing
                textarea markup as a real row so its height matches a real
                blank row exactly rather than an approximation. Not part of
                draft.items — it has no value/onChange of its own — but it
                isn't a dead end either: focusing it (click or Tab, same as
                any real field) calls addRow() to append a real blank item
                and hands focus to that item's own textarea once it mounts
                (see pendingFocusIndexRef above), the same promotion however
                many filler rows are on screen — always the *next* row,
                since addRow always appends at the true end of draft.items
                regardless of which filler row was clicked (matching a real
                paper form: you write on the next blank line, not an
                arbitrary one further down). readOnly on this element itself
                just prevents a keystroke from landing here in the instant
                before that swap. */}
            {Array.from({ length: effectiveFillerCounts[pageIndex] ?? 0 }, (_, fillerIdx) => (
              <tr
                key={`filler-${fillerIdx}`}
                ref={pageIndex === probeFillerPageIndex && fillerIdx === 0 ? probeFillerRowRef : undefined}
              >
                {COL_PCT.map((_, colIdx) =>
                  colIdx === 1 ? (
                    <td key={colIdx} style={cellTd}>
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
                        style={{ ...cellInput(), resize: "none", overflow: "hidden" }}
                      />
                    </td>
                  ) : (
                    <td key={colIdx} style={cellTd} />
                  )
                )}
              </tr>
            ))}
          </tbody>
          {/* Only the last page — see this component's doc comment and
              renderPage's isLastPage. totalsTbodyRef attaches here (not
              page 0) since this is the only page it ever mounts on. Values
              are the grand total across every page (grandTotals), not a
              per-page subtotal. */}
          {isLastPage && (
            <tbody ref={totalsTbodyRef}>
              <SpacerRow cols={COL_PCT.length} />
              <tr style={{ fontWeight: 700 }}>
                {/* "Total" now sits in its own Date column cell instead of a
                    merged colSpan block, so Date/Description/Receipt/Project-CC
                    each keep their own bordered column all the way down to
                    this row, matching the vertical lines above them. */}
                <td style={{ border: "1px solid #000000", padding: 5, textAlign: "center" }}>Total</td>
                {Array.from({ length: totalsColspan - 1 }, (_, i) => (
                  <td key={i} style={{ border: "1px solid #000", padding: 5 }} />
                ))}
                <td style={totalNumTd}>{fmt(grandTotals.gasoline)}</td>
                <td style={totalNumTd}>{fmt(grandTotals.hotel)}</td>
                <td style={totalNumTd}>{fmt(grandTotals.entertain)}</td>
                <td style={totalNumTd}>{fmt(grandTotals.mobile)}</td>
                <td style={totalNumTd}>{fmt(grandTotals.transport)}</td>
                <td style={totalNumTd}>{fmt(grandTotals.other)}</td>
                <td style={totalNumTd}>{fmt(grandTotals.localAmt)}</td>
                <td style={totalNumTd}>{fmt(grandTotals.thb)}</td>
              </tr>
              <SpacerRow cols={COL_PCT.length} />
              <SpacerRow cols={COL_PCT.length} />
            </tbody>
          )}
        </table>

        <div>
          {/* Right edge stops at the end of Local Currency Amount (90.26% of the
              table width) — the real form's Remark box does not extend under
              Thai Baht Total. */}
          <div
            style={{
              marginTop: 8,
              width: "91.26%",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
              border: "1px solid #000",
              padding: "4px 6px",
              minHeight: 26,
              boxSizing: "border-box",
            }}
          >
            <span style={{ fontWeight: 700 }}>Remark:</span>
            <input
              value={draft.remark}
              onChange={(e) => setRemark(e.target.value)}
              style={{ flex: 1, border: "none", background: "transparent", font: "inherit" }}
            />
          </div>

          {/* keep-together (globals.css): print-only break-inside: avoid.
              remeasure()'s pagination already fits this whole block (plus
              its rows) within PAGE_HEIGHT_BUDGET_FA017 on every page, so
              this is a safety net rather than the normal case — a sub-pixel
              rounding difference between screen px and the physical print
              conversion could still, in principle, land the print engine's
              own page break inside this block; if that ever happens, this
              whole certification+signature block moves to the next page as
              one piece instead of splitting mid-signature-box. */}
          <div className="keep-together">
            {/* EMPLOYEES CERTIFICATION spans Date+Description+Receipt+Project/CC
                (columns 1-4). "Total Amount Due to Employee" label spans
                Entertain+Mobile+Transport+Other (columns 7-10), then column 11
                (Local Currency Amount) is left empty on purpose — the real form
                has a gap there — before the boxed value in column 12 (Thai Baht
                Total) alone. This block is rendered on every page unchanged
                (per request), but its value isn't: only the last page has a
                Total row to match against (grandTotals, same figure as that
                row — see this component's doc comment), so every earlier page
                shows "-" here instead of a number that would otherwise be
                orphaned with nothing on this same page to substantiate it. */}
            <div
              style={{
                marginTop: 14,
                fontSize: 12,
                display: "grid",
                gridTemplateColumns: colTemplate,
                alignItems: "end",
              }}
            >
              <div style={{ gridColumn: "1 / 5", border: "1px solid #000", padding: "4px 8px" }}>
                <div style={{ fontWeight: 700 }}>EMPLOYEES CERTIFICATION</div>
                <div>I certify that all the above expenses were incurred on behalf of the company.</div>
              </div>
              <div style={{ gridColumn: "9 / 11 ", fontWeight: 700, whiteSpace: "nowrap" }}>
                Total Amount Due to Employee
              </div>
              <div style={{ gridColumn: "12 / 13", border: "1px solid #000", padding: "3px 8px", textAlign: "right", fontWeight: 700 }}>
                {isLastPage ? fmt(grandTotals.thb) : "-"}
              </div>
            </div>

            {/* Signature grid, positioned to the real F-FA-017 workbook's merged
                cells rather than an evenly-spaced grid — box widths and the gaps
                between them are uneven on purpose (see SIG_COL_PCT above; the top
                row's first box only covers Date + part of Description, which is
                why it needs its own finer column breakdown instead of reusing
                colTemplate). Rendered on every page, each needing its own actual
                signatures — see this component's doc comment. */}
            <div style={{ marginTop: 24, fontSize: 11, display: "grid", gridTemplateColumns: sigColTemplate }}>
              <div style={{ gridColumn: "1 / 3", textAlign: "center" }}>
                <div style={{ border: "1px solid #000", height: 25 }} />
                <div style={{ marginTop: 4 }}>Employee</div>
              </div>
              <div style={{ gridColumn: "4 / 8", textAlign: "center" }}>
                <div style={{ border: "1px solid #000", height: 25 }} />
                <div style={{ marginTop: 4 }}>Verified by .....................................................</div>
              </div>
              <div style={{ gridColumn: "9 / 13", textAlign: "center" }}>
                <div style={{ border: "1px solid #000", height: 25 }} />
                <div style={{ marginTop: 4 }}>Verified by Division Head / Department Head</div>
              </div>
            </div>
            <div style={{ marginTop: 20, fontSize: 11, display: "grid", gridTemplateColumns: sigColTemplate }}>
              <div style={{ gridColumn: "1 / 3", textAlign: "center" }}>
                <div style={{ border: "1px solid #000", height: 25 }} />
                <div style={{ marginTop: 4 }}>Verified by HR</div>
              </div>
              <div style={{ gridColumn: "4 / 6", textAlign: "center" }}>
                <div style={{ border: "1px solid #000", height: 25 }} />
                <div style={{ marginTop: 4 }}>Verified by FA</div>
              </div>
              <div style={{ gridColumn: "8 / 11", textAlign: "center" }}>
                <div style={{ border: "1px solid #000", height: 25 }} />
                <div style={{ marginTop: 4 }}>Approved by ....................</div>
              </div>
              <div style={{ gridColumn: "12 / 14", textAlign: "center" }}>
                <div style={{ border: "1px solid #000", height: 25 }} />
                <div style={{ marginTop: 4 }}>Approved by .................</div>
              </div>
            </div>
            <div style={{ marginTop: 16, fontSize: 9.5, lineHeight: 1.5, color: "#333" }}>
              <div>
                * ค่าใช้จ่ายรวมไม่เกิน 20,000 บาท หัวหน้างานผู้มีอำนาจอนุมัติ
                ลงนามอนุมัติร่วมกับประธานเจ้าหน้าที่ฝ่ายการเงินและบัญชี
                แต่ถ้าเกิน 20,000 บาท ประธานเจ้าหน้าที่ฝ่ายการเงินและบัญชี
                ลงนามอนุมัติร่วมกับประธานเจ้าหน้าที่บริหาร
              </div>
              <div>** ค่าใช้จ่ายรวมเกิน 100,000 บาท กรรมการผู้มีอำนาจลงนามอนุมัติ</div>
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
      <div className="no-print" style={{ maxWidth: PAPER_WIDTH_FA017, margin: "0 auto 8px" }}>
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
