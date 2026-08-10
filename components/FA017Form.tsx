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
import { computePageBreaks, pageBreaksEqual } from "@/lib/pagination";
import { fa017RowTotal, fa017Totals } from "@/lib/totals";
import { isFA017ItemEmpty } from "@/lib/types";
import type { Draft, EmployeeSnapshot, FA017Item, ItemField, SavedItemEntry } from "@/lib/types";
import { useSavedItems } from "@/lib/useSavedItems";
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
const th: React.CSSProperties = { border: "1px solid #000", padding: "4px 2px", fontSize: 10, lineHeight: 1.2, verticalAlign: "top", whiteSpace: "nowrap" };
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
const thExpenseHead: React.CSSProperties = { ...th, fontSize: 9 };
const thDescriptionHead: React.CSSProperties = { ...th, fontSize: 9, textAlign: "center" };
const thLocalCurrencyHead: React.CSSProperties = { ...th, fontSize: 9 };
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
const cellTd: React.CSSProperties = { border: "1px solid #000", padding: "1px 3px" };
// Spacer rows around Total: same bordered grid as every other row (one <td>
// per column, so the vertical lines still line up with the columns above),
// but padding/line-height stripped and height pinned to 4px so the row
// itself reads as a thin divider rather than a normal data row.
const spacerTd: React.CSSProperties = { border: "1px solid #000", padding: 0, height: 10, lineHeight: 0, fontSize: 1 };

const cellInput = (align?: "right" | "center"): React.CSSProperties => ({
  width: "100%",
  boxSizing: "border-box",
  border: "none",
  font: "inherit",
  background: "transparent",
  fontSize: TABLE_FONT_SIZE,
  textAlign: align,
});

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
// each. Date (index 0) is untouched — it holds a live day/month/year
// control, same as DATE: above.
const COL_PCT = SHOW_PROJECT_FIELD
  ? [7.94, 25.25, 8.53, 5.73, 5.73, 5.73, 5.73, 5.73, 5.72, 5.72, 9.45, 8.74]
  : [7.94, 27.37, 10.91, 8.61, 4.22, 4.22, 4.22, 4.22, 4.22, 10.11, 9.74]; // Project/CC's 4.22% just dropped (this branch isn't used anywhere in the app today)

// The Excel source's "Description" column is actually two real columns (B
// and C) merged together everywhere EXCEPT the top two signature boxes,
// which merge only A:B (i.e. Date + just the B part of Description). This
// finer breakdown is only needed for those two boxes' widths/gap below.
// The 4.15/5.85 split (originally summing to Description's 10.00, then to
// 33.00) is scaled the same way to Description's current 25.25, and the
// tail mirrors COL_PCT's indices 2-11 so both tables' columns still align.
const SIG_COL_PCT = [7.94, 10.48, 14.77, 8.53, 5.73, 5.73, 5.73, 5.73, 5.73, 5.72, 5.72, 9.45, 8.74];

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
  background: "transparent",
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
// Pagination: no cap on how many rows "+ เพิ่มแถว" can add — instead, every
// render checks the actual rendered page height against
// PAGE_HEIGHT_BUDGET_FA017 and, when it's over (easily reached in normal
// use: Description is an auto-growing <textarea> below, so even a couple of
// wrapped descriptions push a page well past budget), falls back to
// splitting rows across multiple ".paper" sheets. Every sheet — not just
// the last — repeats the full header AND the full tail (Total row + Remark
// + certification/signature): each physical page is meant to stand on its
// own as a complete, independently signable copy of the form, so a page's
// "Total"/"Total Amount Due to Employee" reflect only that page's own
// rows, not the grand total across every page. See lib/pagination.ts.
export default function FA017Form({
  draft,
  setEmpField,
  setMonthName,
  setMonthYear,
  setDay,
  setRemark,
  updateItem,
  savedItems,
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

  const firstPageRef = useRef<HTMLDivElement>(null);
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const totalsTbodyRef = useRef<HTMLTableSectionElement>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
  const [pages, setPages] = useState<number[][] | null>(null);

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

  // Two-phase overflow check, re-run after every commit (see the no-deps
  // note below): first, the cheap/accurate path — read the single rendered
  // page's real height directly and compare to budget. Only when that's
  // over budget do we fall back to the decomposed header/row/tail
  // measurements (border-collapse tables can make summed parts drift a few
  // px from the whole, hence the safety margin) to decide where to split.
  function remeasure() {
    if (effectivePages.length === 1 && firstPageRef.current) {
      const h = firstPageRef.current.getBoundingClientRect().height;
      if (h <= PAGE_HEIGHT_BUDGET_FA017) {
        if (pages !== null) setPages(null);
        return;
      }
    }
    // Measured as deltas between real rendered edges, not by summing each
    // piece's own getBoundingClientRect().height — summing independent
    // pieces silently drops .paper's own top/bottom padding (belongs to no
    // single child) and the Remark box's marginTop:8, which collapses
    // through its borderless/paddingless parent's top edge and so isn't
    // reflected in any single element's own height either. Deltas against
    // the owning .paper's actual top/bottom account for both for free,
    // since they're just "how far apart these two real points are" rather
    // than a sum that has to know about every padding/collapse rule in
    // between. theadRef/totalsTbodyRef always live on page 0 (every page
    // repeats the same header and tail content, so measuring either from
    // any one page is representative of all of them), hence both deltas
    // are read against firstPageRef.
    const headerHeight = theadRef.current
      ? theadRef.current.getBoundingClientRect().bottom - (firstPageRef.current?.getBoundingClientRect().top ?? 0)
      : 0;
    // Content only (excludes .paper's own bottom padding, already baked
    // into the paper.bottom - totalsTbody.top delta) — that reserve is
    // folded into budgetPx below instead, applied once per page uniformly,
    // and must not be counted twice here.
    const tailHeight = totalsTbodyRef.current
      ? (firstPageRef.current?.getBoundingClientRect().bottom ?? 0) - totalsTbodyRef.current.getBoundingClientRect().top - PAPER_PADDING_FA017
      : 0;
    const rowHeights = items.map((_, i) => rowRefs.current.get(i)?.getBoundingClientRect().height ?? 0);
    const next = computePageBreaks({
      headerHeight,
      tailHeight,
      rowHeights,
      // PAPER_PADDING_FA017 reserves every page's own bottom padding (see
      // tailHeight's comment above) — without it, a page's header+rows
      // alone could measure as "fits" while ignoring the padding still due
      // before the true physical edge. The extra 2px is a small safety
      // margin for sub-pixel rounding.
      budgetPx: PAGE_HEIGHT_BUDGET_FA017 - PAPER_PADDING_FA017 - 2,
    });
    const isTrivial = next.length === 1 && next[0].length === items.length;
    if (isTrivial) {
      if (pages !== null) setPages(null);
    } else if (pages === null || !pageBreaksEqual(pages, next)) {
      setPages(next);
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

  // Shared behavior for the 7 per-row amount fields (Gasoline..Local
  // Currency Amount): step="0.01" for 2-decimal increments, snap the
  // displayed value to 2 decimals on blur (only when non-empty — an
  // untouched cell stays blank rather than turning into "0.00"), and
  // clear the field on focus if it's showing zero so typing a fresh
  // number doesn't start by prefixing onto a "0".
  function amountFieldProps(i: number, field: ItemField, value: string) {
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
    };
  }

  function renderPage(pageIndices: number[], pageIndex: number) {
    // Per-page subtotal — every page carries its own Total row +
    // certification/signature block (see this component's doc comment), so
    // each one totals only the rows actually printed on it, not every
    // page's combined grand total.
    const pageTotals = fa017Totals(pageIndices.map((i) => items[i]));
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
            <div style={{ textAlign: "right", fontSize: 12, color: "#555", justifySelf: "end" }}>
              F-FA-017
            </div>
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
                      this column shares with the row below stays untouched. */}
                  <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={draft.day}
                      onChange={(e) => setDay(Number(e.target.value))}
                      className="no-spin date-field"
                      style={{ width: 18, boxSizing: "border-box", border: "none", background: "transparent", font: "inherit", fontSize: 9, padding: 1, textAlign: "center" }}
                    />
                    <span style={{ fontSize: 9 }}>/</span>
                    <select
                      value={draft.monthName}
                      onChange={(e) => setMonthName(e.target.value)}
                      className="no-arrow date-field"
                      style={{ width: 26, boxSizing: "border-box", border: "none", background: "transparent", font: "inherit", fontSize: 9, padding: 1, textAlign: "center" }}
                    >
                      {MONTH_OPTIONS.map((mo) => (
                        <option key={mo.value} value={mo.value}>
                          {mo.label}
                        </option>
                      ))}
                    </select>
                    <span style={{ fontSize: 9 }}>/</span>
                    <input
                      type="number"
                      value={draft.monthYear}
                      onChange={(e) => setMonthYear(Number(e.target.value))}
                      className="no-spin date-field"
                      style={{ flex: 1, minWidth: 32, boxSizing: "border-box", border: "none", background: "transparent", font: "inherit", fontSize: 9, padding: 1, textAlign: "center" }}
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
                    style={{ width: "100%", boxSizing: "border-box", border: "none", background: "transparent", font: "inherit" }}
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
                      style={{ width: 14, boxSizing: "border-box", border: "none", background: "transparent", font: "inherit", fontSize: 8, padding: 0, textAlign: "center" }}
                    />
                    {(d || m || y) && <span style={{ fontSize: 10 }}>/</span>}
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={m}
                      onChange={(e) => updateItem(i, "date", joinDMY(d, e.target.value, y))}
                      className="no-spin"
                      style={{ width: 14, boxSizing: "border-box", border: "none", background: "transparent", font: "inherit", fontSize: 8, padding: 0, textAlign: "center" }}
                    />
                    {(d || m || y) && <span style={{ fontSize: 10 }}>/</span>}
                    <input
                      type="number"
                      value={y}
                      onChange={(e) => updateItem(i, "date", joinDMY(d, m, e.target.value))}
                      className="no-spin"
                      style={{ width: 26, boxSizing: "border-box", border: "none", background: "transparent", font: "inherit", fontSize: 8, padding: 0, textAlign: "center" }}
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
                    className="no-print"
                    onClick={async () => {
                      await saveItemRow(items[i]);
                      setJustSavedRow(i);
                      setTimeout(() => setJustSavedRow((r) => (r === i ? null : r)), 2000);
                    }}
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
                    style={{ border: "none", background: "transparent", font: "inherit", fontSize: TABLE_FONT_SIZE, textAlign: "center" }}
                  >
                    <option value=""></option>
                    <option value="Y">Yes</option>
                    <option value="N">No</option>
                  </select>
                </td>
                {SHOW_PROJECT_FIELD && (
                  <td style={cellTd}>
                    <input value={it.projectCC} onChange={(e) => updateItem(i, "projectCC", e.target.value)} style={cellInput("center")} />
                  </td>
                )}
                <td style={cellTd}>
                  <input {...amountFieldProps(i, "gasoline", it.gasoline)} style={cellInput("right")} />
                </td>
                <td style={cellTd}>
                  <input {...amountFieldProps(i, "hotel", it.hotel)} style={cellInput("right")} />
                </td>
                <td style={cellTd}>
                  <input {...amountFieldProps(i, "entertain", it.entertain)} style={cellInput("right")} />
                </td>
                <td style={cellTd}>
                  <input {...amountFieldProps(i, "mobile", it.mobile)} style={cellInput("right")} />
                </td>
                <td style={cellTd}>
                  <input {...amountFieldProps(i, "transport", it.transport)} style={cellInput("right")} />
                </td>
                <td style={cellTd}>
                  <input {...amountFieldProps(i, "other", it.other)} style={cellInput("right")} />
                </td>
                <td style={cellTd}>
                  <input {...amountFieldProps(i, "localAmt", it.localAmt)} style={cellInput("right")} />
                </td>
                <td style={{ ...cellTd, textAlign: "right", fontWeight: 600 }}>
                  {isFA017ItemEmpty(it) ? "" : fmt(fa017RowTotal(it))}
                </td>
              </tr>
              );
            })}
          </tbody>
          <tbody ref={pageIndex === 0 ? totalsTbodyRef : undefined}>
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
              <td style={{ border: "1px solid #000", padding: 5, textAlign: "right" }}>{fmt(pageTotals.gasoline)}</td>
              <td style={{ border: "1px solid #000", padding: 5, textAlign: "right" }}>{fmt(pageTotals.hotel)}</td>
              <td style={{ border: "1px solid #000", padding: 5, textAlign: "right" }}>{fmt(pageTotals.entertain)}</td>
              <td style={{ border: "1px solid #000", padding: 5, textAlign: "right" }}>{fmt(pageTotals.mobile)}</td>
              <td style={{ border: "1px solid #000", padding: 5, textAlign: "right" }}>{fmt(pageTotals.transport)}</td>
              <td style={{ border: "1px solid #000", padding: 5, textAlign: "right" }}>{fmt(pageTotals.other)}</td>
              <td style={{ border: "1px solid #000", padding: 5, textAlign: "right" }}>{fmt(pageTotals.localAmt)}</td>
              <td style={{ border: "1px solid #000", padding: 5, textAlign: "right" }}>{fmt(pageTotals.thb)}</td>
            </tr>
            <SpacerRow cols={COL_PCT.length} />
            <SpacerRow cols={COL_PCT.length} />
          </tbody>
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
                Total) alone. Uses this page's own pageTotals, matching the
                Total row directly above — see this component's doc comment. */}
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
                {fmt(pageTotals.thb)}
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
    </>
  );
}
