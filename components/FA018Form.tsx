"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";
import { PAGE_HEIGHT_BUDGET_FA018, PAPER_PADDING_FA018, PAPER_WIDTH_FA018 } from "@/lib/constants";
import { fmt, joinDMY, splitDMY } from "@/lib/format";
import { computePageBreaks, pageBreaksEqual } from "@/lib/pagination";
import { fa018Total } from "@/lib/totals";
import type { Draft, EmployeeSnapshot, FA018Item, ItemField, SavedItemEntry } from "@/lib/types";
import { useSavedItems } from "@/lib/useSavedItems";
import SavedListManager from "@/components/SavedListManager";

const cellInput: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "none",
  font: "inherit",
  background: "transparent",
};

const th: React.CSSProperties = { border: "1px solid #000", padding: 6 };
const td: React.CSSProperties = { border: "1px solid #000", padding: "2px 4px" };

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

// Ported 1:1 from the `isFA018` sc-if block in the design source: paper
// header, employee/month fields, item table, certification text, signatures.
//
// Pagination: no cap on how many rows "+ เพิ่มแถว" can add — every render
// checks the actual rendered page height against PAGE_HEIGHT_BUDGET_FA018
// (lib/constants.ts) and, when it's over, falls back to splitting rows
// across multiple ".paper" sheets (see lib/pagination.ts). รายการ is a
// plain <input> (no wrap/grow, unlike FA017's Description textarea), so a
// row's height is fixed — content wrapping isn't what triggers a split
// here, adding enough rows is. Every sheet — not just the last — repeats
// the full header AND the full tail (รวม row + certification/signature):
// each physical page is meant to stand on its own as a complete,
// independently signable copy of the form, so a page's "รวม" reflects only
// that page's own rows, not the grand total across every page.
export default function FA018Form({
  draft,
  setEmpField,
  updateItem,
  savedItems,
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

  const firstPageRef = useRef<HTMLDivElement>(null);
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const totalsTbodyRef = useRef<HTMLTableSectionElement>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
  const [pages, setPages] = useState<number[][] | null>(null);

  // pages is only reconciled by the remeasure() effect below, which runs
  // AFTER render — see FA017Form's identical guard for why a stale pages
  // (e.g. right after removeLastRow shrinks draft.items) must be ignored
  // for this render rather than mapped into items[i], which would crash
  // fa018Total downstream on an out-of-range absolute index.
  const pagesRowCount = pages?.reduce((sum, page) => sum + page.length, 0) ?? -1;
  const effectivePages = pages !== null && pagesRowCount === items.length ? pages : [items.map((_, i) => i)];

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
    if (effectivePages.length === 1 && firstPageRef.current) {
      const h = firstPageRef.current.getBoundingClientRect().height;
      if (h <= PAGE_HEIGHT_BUDGET_FA018) {
        if (pages !== null) setPages(null);
        return;
      }
    }
    // Measured as deltas between real rendered edges rather than summing
    // each piece's own height — see FA017Form's identical remeasure() for
    // why (in short: summing drops .paper's own padding and any collapsed
    // child margins, which a delta against the owning .paper's real
    // top/bottom edge accounts for automatically). theadRef/totalsTbodyRef
    // always live on page 0 (every page repeats the same header and tail
    // content), so both deltas are read against firstPageRef.
    const headerHeight = theadRef.current
      ? theadRef.current.getBoundingClientRect().bottom - (firstPageRef.current?.getBoundingClientRect().top ?? 0)
      : 0;
    // Content only (excludes .paper's own bottom padding, already baked
    // into the paper.bottom - totalsTbody.top delta) — that reserve is
    // folded into budgetPx below instead, applied once per page uniformly,
    // and must not be counted twice here.
    const tailHeight = totalsTbodyRef.current
      ? (firstPageRef.current?.getBoundingClientRect().bottom ?? 0) - totalsTbodyRef.current.getBoundingClientRect().top - PAPER_PADDING_FA018
      : 0;
    const rowHeights = items.map((_, i) => rowRefs.current.get(i)?.getBoundingClientRect().height ?? 0);
    const next = computePageBreaks({
      headerHeight,
      tailHeight,
      rowHeights,
      // PAPER_PADDING_FA018 reserves every page's own bottom padding (see
      // tailHeight's comment above); the extra 2px is a small safety
      // margin for sub-pixel rounding.
      budgetPx: PAGE_HEIGHT_BUDGET_FA018 - PAPER_PADDING_FA018 - 2,
    });
    const isTrivial = next.length === 1 && next[0].length === items.length;
    if (isTrivial) {
      if (pages !== null) setPages(null);
    } else if (pages === null || !pageBreaksEqual(pages, next)) {
      setPages(next);
    }
  }

  useLayoutEffect(() => {
    remeasure();
  }); // no dependency array — idempotent, see FA017Form's identical effect for rationale

  function renderPage(pageIndices: number[], pageIndex: number) {
    // Per-page subtotal — every page carries its own รวม row +
    // certification/signature block (see this component's doc comment), so
    // each one totals only the rows actually printed on it.
    const pageTotal = fmt(fa018Total(pageIndices.map((i) => items[i])));
    return (
      <div
        key={pageIndex}
        ref={pageIndex === 0 ? firstPageRef : undefined}
        className="paper"
        style={{ width: PAPER_WIDTH_FA018, padding: `${PAPER_PADDING_FA018}px 40px` }}
      >
        <div>
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
            <div style={{ textAlign: "right", fontSize: 12, color: "#555", justifySelf: "end" }}>
              F-FA-018
            </div>
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
                <td style={td}>
                  <input
                    value={it.projectNo}
                    onChange={(e) => updateItem(i, "projectNo", e.target.value)}
                    style={cellInput}
                  />
                </td>
                <td style={td}>
                  <input
                    type="number"
                    value={it.amount}
                    onChange={(e) => updateItem(i, "amount", e.target.value)}
                    style={{ ...cellInput, textAlign: "right" }}
                  />
                </td>
              </tr>
              );
            })}
          </tbody>
          <tbody ref={pageIndex === 0 ? totalsTbodyRef : undefined}>
            <tr>
              <td colSpan={3} style={{ ...th, textAlign: "center", fontWeight: 700 }}>
                รวม
              </td>
              <td style={{ ...th, textAlign: "right", fontWeight: 700 }}>{pageTotal}</td>
            </tr>
          </tbody>
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
    </>
  );
}
