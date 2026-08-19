// Pure, framework-free page-chunking used by FA017Form/FA018Form's runtime
// pagination (see lib/constants.ts's PAGE_HEIGHT_BUDGET_FA017/018): a page
// holds as many rows as physically fit — greedy packing, not a fixed count
// — so a fresh claim comfortably fits one page and only spills onto
// additional A4 sheets once real rendered content actually overflows one.
// Only the LAST page carries the Total/รวม row (+ FA017's surrounding
// spacer rows); every page still repeats the same header and the same
// Remark/certification/signature tail, so that recurring part is reserved
// on every page while the Total block is reserved only where it actually
// renders — meaning a non-last page can pack slightly more content than
// the last one, since it doesn't need to leave room for that block.
//
// Packing is deliberately front-loaded and left that way — earlier pages
// grab as many real rows as they can hold, so whatever's left over for the
// last page can be as little as a single row. That used to read as a
// broken, nearly-blank sheet; it no longer does, because FA017Form/
// FA018Form now pad every page's own leftover space with blank filler rows
// (see computeFillerCounts below) instead of reshuffling real rows
// backward to "balance" the split — a page with 1 real row plus 13 blank
// ones is visually indistinguishable from a fully-packed one, and it keeps
// real data exactly where step 1/2 packed it (page 1 stays maximally full,
// matching how a real paginated form is expected to behave) rather than
// thinning it out to match a sparser last page.

export interface PageBreaksInput {
  headerHeight: number;
  recurringTailHeight: number; // Remark + certification/signature — identical on every page
  lastPageExtraHeight: number; // Total/รวม row (+ spacer rows for FA017) — only the final page has this
  rowHeights: number[]; // index i == absolute item index i
  budgetPx: number;
}

// Greedy bin-packing with a last-page correction pass: returns one entry
// per output page, each an array of absolute item indices (into the
// original items array) belonging on that page, in order. Always returns
// at least one page (possibly with zero rows — e.g. a genuinely empty
// items array), so callers never need a special case for "no pages".
export function computePageBreaks({
  headerHeight,
  recurringTailHeight,
  lastPageExtraHeight,
  rowHeights,
  budgetPx,
}: PageBreaksInput): number[][] {
  // 1. Pack rows in order, reserving only the recurring tail per page —
  // every page could in principle end up being the last one, but at this
  // point we don't yet know which, so pack as if it isn't (the denser
  // case); the pass below corrects the actual last page afterward.
  const pages: number[][] = [];
  let current: number[] = [];
  let currentHeight = headerHeight;

  for (let i = 0; i < rowHeights.length; i++) {
    const rowH = rowHeights[i];
    // Only break BEFORE a row if the current page already has content — a
    // single row taller than an entire empty page can't be made to fit by
    // moving it anywhere, so it's placed alone rather than looping forever.
    if (current.length > 0 && currentHeight + rowH + recurringTailHeight > budgetPx) {
      pages.push(current);
      current = [];
      currentHeight = headerHeight;
    }
    current.push(i);
    currentHeight += rowH;
  }
  pages.push(current);

  // 2. The actual last page also needs room for the Total block, which
  // step 1 didn't reserve for it (it packed every page — including
  // whichever ends up last — against the lighter recurring-tail-only
  // budget). If the last page doesn't fit the stricter last-page budget,
  // shed its last row forward into the next page (creating one if needed)
  // and re-check the same page again. Earlier pages never need this
  // check: step 1 already packed them against exactly the budget this
  // loop would apply to a non-last page, so they're always already within
  // it. Only breaking a page already down to one row mirrors step 1's own
  // rule: an oversized single row is placed alone rather than looping
  // forever.
  let p = pages.length - 1;
  while (p < pages.length) {
    const isLast = p === pages.length - 1;
    const budget = budgetPx - headerHeight - recurringTailHeight - (isLast ? lastPageExtraHeight : 0);
    const contentHeight = pages[p].reduce((sum, i) => sum + rowHeights[i], 0);
    if (contentHeight <= budget || pages[p].length <= 1) {
      p++;
      continue;
    }
    const overflowRow = pages[p].pop()!;
    if (p + 1 >= pages.length) pages.push([]);
    pages[p + 1].unshift(overflowRow);
    // Don't advance p — recheck this same page now that it has one fewer row.
  }

  return pages;
}

// Post-processing companion to computePageBreaks, run on its output before
// filler rows are computed: a spillover last page can end up holding only
// blank/padding rows (see FA017Form/FA018Form's items being padded up to
// DEFAULT_ROWS_FA017/018 with empty rows before printing) — visually that
// reads as an empty extra sheet with nothing but the Total block on it,
// even though every row on it is, technically, correctly placed. When that
// happens, pull the previous page's own last row over too (its filler-row
// budget still gets recomputed against this new split afterward, same as
// any other page), so the spillover page shows at least one row with real
// content instead of none. `isEmpty` receives an absolute item index (same
// indexing as computePageBreaks' output) and reports whether that row has
// no real data — callers pass FA017Item/FA018Item's own isXItemEmpty here,
// which this framework-free file has no reason to know about itself.
export function ensureLastPageHasContent(pages: number[][], isEmpty: (i: number) => boolean): number[][] {
  if (pages.length < 2) return pages;
  const last = pages[pages.length - 1];
  if (last.some((i) => !isEmpty(i))) return pages;
  const prev = pages[pages.length - 2];
  if (prev.length === 0) return pages;
  const moved = prev[prev.length - 1];
  return [...pages.slice(0, -2), prev.slice(0, -1), [moved, ...last]];
}

// Companion to computePageBreaks: given the same page grouping and per-page
// metrics used to pack real rows, how many blank filler rows each page
// needs appended so its table area reaches the same height as a
// fully-packed page — see this file's top comment for why blank filler
// rows (rendered by FA017Form/FA018Form, not by this function) replace the
// old row-rebalancing approach. Pure and framework-free like
// computePageBreaks; `fillerRowHeight` is a single blank row's real
// rendered height (identical on every page, so one measurement covers all
// of them) — null/0 means it hasn't been measured yet, in which case this
// renders a single probe row on any page with room, for the caller to
// measure and feed back in on the next pass (mirrors how computePageBreaks
// itself is re-run every commit until it converges).
export function computeFillerCounts({
  pages,
  rowHeights,
  headerHeight,
  recurringTailHeight,
  lastPageExtraHeight,
  budgetPx,
  fillerRowHeight,
}: {
  pages: number[][];
  rowHeights: number[];
  headerHeight: number;
  recurringTailHeight: number;
  lastPageExtraHeight: number;
  budgetPx: number;
  fillerRowHeight: number | null;
}): number[] {
  return pages.map((page, p) => {
    const isLast = p === pages.length - 1;
    const available = budgetPx - headerHeight - recurringTailHeight - (isLast ? lastPageExtraHeight : 0);
    const used = page.reduce((sum, i) => sum + rowHeights[i], 0);
    const remaining = available - used;
    if (remaining <= 0) return 0;
    if (!fillerRowHeight || fillerRowHeight <= 0) return 1; // probe
    return Math.floor(remaining / fillerRowHeight);
  });
}

// Structural equality for the small arrays computeFillerCounts produces —
// same purpose as pageBreaksEqual below: skip a setState when
// recomputation didn't actually change anything.
export function fillerCountsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
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
