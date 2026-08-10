// Pure, framework-free page-chunking used by FA017Form/FA018Form's runtime
// overflow check (see lib/constants.ts's PAGE_HEIGHT_BUDGET_FA017/018):
// "+ เพิ่มแถว" has no row-count cap, so a page's real rendered height is
// what decides whether it needs to split — checked directly first (cheap,
// exact), and when it doesn't fit, the form falls back to this to decide
// where to split the item rows across additional ".paper" sheets. Every
// page repeats the same header AND the same tail (totals row + Remark +
// certification/signature) — each physical page is meant to stand on its
// own as a complete, independently signable copy of the form, per request —
// so both are fixed per-page overhead the packer reserves room for on every
// page, not just the last.

export interface PageBreaksInput {
  headerHeight: number;
  tailHeight: number;
  rowHeights: number[]; // index i == absolute item index i
  budgetPx: number;
}

// Greedy bin-packing: returns one entry per output page, each an array of
// absolute item indices (into the original items array) belonging on that
// page, in order. Always returns at least one page (possibly with zero
// rows — e.g. a genuinely empty items array), so callers never need a
// special case for "no pages".
export function computePageBreaks({
  headerHeight,
  tailHeight,
  rowHeights,
  budgetPx,
}: PageBreaksInput): number[][] {
  const pages: number[][] = [];
  let current: number[] = [];
  let currentHeight = headerHeight;

  for (let i = 0; i < rowHeights.length; i++) {
    const rowH = rowHeights[i];
    // Only break BEFORE a row if the current page already has content — a
    // single row taller than an entire empty page (header + tail alone)
    // can't be made to fit by moving it anywhere, so it's placed alone
    // rather than looping forever. Checked against currentHeight + rowH +
    // tailHeight (not just currentHeight + rowH) since every page must
    // leave room for its own tail block, not only the final one.
    if (current.length > 0 && currentHeight + rowH + tailHeight > budgetPx) {
      pages.push(current);
      current = [];
      currentHeight = headerHeight;
    }
    current.push(i);
    currentHeight += rowH;
  }
  pages.push(current);

  return pages;
}

// Structural equality for the small arrays computePageBreaks produces —
// used to skip a setState when recomputation didn't actually change
// anything (see the remeasure() effects in FA017Form/FA018Form).
export function pageBreaksEqual(a: number[][], b: number[][]): boolean {
  if (a.length !== b.length) return false;
  for (let p = 0; p < a.length; p++) {
    if (a[p].length !== b[p].length) return false;
    for (let r = 0; r < a[p].length; r++) {
      if (a[p][r] !== b[p][r]) return false;
    }
  }
  return true;
}
