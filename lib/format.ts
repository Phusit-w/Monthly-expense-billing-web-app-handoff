// Ported from Component.num / Component.fmt in the design source.
export function num(v: unknown): number {
  const n = parseFloat(String(v ?? ""));
  return isNaN(n) ? 0 : n;
}

// decimals defaults to 2 (every call site on the actual claim forms/tables
// needs 2 — standard accounting practice, left untouched) — TravelCalculator
// passes 0 for its headline totals instead, which don't belong on a formal
// form field and are cheap estimates anyway (see its own rounding note).
export function fmt(n: unknown, decimals: number = 2): string {
  const value = num(n);
  // Zero amounts print as "-" instead of "0.00" — standard practice on
  // these paper forms, and matches every row/column total in FA017Form,
  // FA018Form and RecordsTable since they all route through this helper.
  if (value === 0) return "-";
  return value.toLocaleString("th-TH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Shared by both forms' per-row date column (FA017Form and FA018Form): a
// plain day/month/year triple of number inputs instead of a native
// <input type="date">. FA018's item rows used to be a real type="date", but
// its calendar dropdown is tall enough to visually cover several rows below
// it in a table this dense — a click meant for a different field often
// lands on dead space inside the still-open popup instead of that field,
// so it never closes and the row looks stuck. FA017 hit the same kind of
// native-picker sizing/chrome problem earlier (see its old comment on this
// column) and solved it the same way, so FA018 now follows suit.
//
// The stored value stays a single string on the item, split back out for
// display — split() also accepts the old native input's "yyyy-mm-dd" so any
// previously-saved rows (FA017 or FA018) still show correctly.
//
// join() deliberately does NOT zero-pad a part that's still empty (e.g.
// typing just the day gives "3//", not "03/00/"): a real day/month value
// checked back through split() has to round-trip through its strict dmy
// regex on every keystroke, and an eagerly-padded "00" placeholder doesn't
// match that regex (it needs a 4-digit year) — so it silently wiped
// whatever had already been typed instead of holding it. "3//" splits back
// to exactly { d: "3", m: "", y: "" }, so partial entry (typing day, then
// month, then year) survives every intermediate render.
export function splitDMY(v: string): { d: string; m: string; y: string } {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  if (iso) return { y: iso[1], m: iso[2], d: iso[3] };
  const [d = "", m = "", y = ""] = v.split("/");
  return { d, m, y };
}
export function joinDMY(d: string, m: string, y: string): string {
  if (!d && !m && !y) return "";
  return `${d}/${m}/${y}`;
}
