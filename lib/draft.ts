// Shared by the entry-form components (EntryFormFA017/EntryFormFA018) so the
// "day/month(number)/year(Buddhist era)" default isn't duplicated in both —
// mirrors the same new Date()/+543 logic app/bill/new/[type]/page.tsx uses
// when it builds a fresh empty Draft server-side.
export function currentDMY(): { day: number; monthName: string; monthYear: number } {
  const now = new Date();
  return {
    day: now.getDate(),
    monthName: String(now.getMonth() + 1),
    monthYear: now.getFullYear() + 543,
  };
}

// Today's date as "yyyy-mm-dd" — the value shape native <input type="date">
// wants (and that splitDMY, lib/format.ts, already knows how to parse back
// out). Built from local Y/M/D rather than now.toISOString().slice(0,10) —
// toISOString() converts to UTC first, which can land on the wrong calendar
// day near midnight in timezones ahead of UTC (Thailand is UTC+7).
export function todayISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// currentDMY()'s counterpart for a user-picked date rather than "now" —
// used by EntryFormFA017's "DATE :" field (a native <input type="date">, so
// its value already comes in as "yyyy-mm-dd") so the entry form's Draft
// carries the date the user actually chose instead of always today's,
// matching the same day/month(number)/year(Buddhist era) shape FA017Form's
// DATE: field expects. The picker itself always displays a Gregorian year
// (browser-controlled, see EntryFormFA017.tsx's comment on why that can't
// be overridden from the page), so this +543 conversion is still needed.
export function dmyFromISODate(iso: string): { day: number; monthName: string; monthYear: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { day: d, monthName: String(m), monthYear: y + 543 };
}
