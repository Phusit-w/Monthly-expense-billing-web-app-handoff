export const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
] as const;

// Date field selects a month by number (1-12) rather than by Thai month
// name — the dropdown's value/label are the same numeric string, so
// draft.monthName stores e.g. "8" instead of "สิงหาคม".
export const MONTH_OPTIONS = THAI_MONTHS.map((_, i) => {
  const n = String(i + 1);
  return { value: n, label: n };
});

// rowsFA018/rowsFA017 were exposed as design-tool preview props on the
// original .dc.html component, but the row *counts* below are corrected
// against the real F-FA-018 / F-FA-017 PDF forms currently in use (10 and
// 8 blank rows respectively) rather than the dc.html default of 5.
// showProjectField/tableFontSize remain fixed constants, not a settings UI,
// since nothing suggested those need to match a specific real-world value.
export const DEFAULT_ROWS_FA018 = 10;
export const DEFAULT_ROWS_FA017 = 8;
export const SHOW_PROJECT_FIELD = true;
export const TABLE_FONT_SIZE = 11;

export const PAPER_WIDTH_FA018 = "794px";
export const PAPER_WIDTH_FA017 = "1123px";

// "+ เพิ่มแถว" has no row-count cap — FA017Form/FA018Form's runtime
// pagination (lib/pagination.ts) instead measures each page's actual
// rendered height against these budgets (@page margin is 0 — see
// BillEditor.tsx — so the full page height is available: 210mm for FA017's
// landscape orientation, 297mm for FA018's portrait one) and automatically
// continues onto additional A4 sheets once a page overflows, rather than
// blocking further rows at a fixed count. Historical measurement that
// originally calibrated a (since-removed) row cap, kept as a reference
// point for these budgets: in Chrome, adding empty rows one at a time and
// reading .paper's rendered height (1mm = 96/25.4px) — FA017's .paper hit
// 790.09px at 12 rows / 814.09px at 13, FA018's hit 1109.78px at 30 rows /
// 1132.78px at 31.
export const PAGE_HEIGHT_BUDGET_FA017 = 793.7; // 210mm landscape
export const PAGE_HEIGHT_BUDGET_FA018 = 1122.52; // 297mm portrait

// .paper's own top/bottom padding (the vertical half of each form's
// `padding: "Npx Mpx"` — FA017Form/FA018Form both use this constant for
// that style so it can never drift from the value below). Every physical
// page pays this at its bottom edge, not just a page that happens to carry
// the tail block — FA017Form/FA018Form's pagination math (remeasure())
// reserves it out of the usable per-page budget for exactly that reason:
// without it, a page's rows alone could measure as "fits" while ignoring
// the padding still due before the true physical edge, letting the page
// silently overflow by that much (the bug this reserve fixes).
export const PAPER_PADDING_FA017 = 24;
export const PAPER_PADDING_FA018 = 30;
