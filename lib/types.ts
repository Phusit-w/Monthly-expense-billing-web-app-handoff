// Shared shapes, ported 1:1 from the `Component` class in the design source:
// monthly-expense-billing-web-app/project/ระบบบิลค่าใช้จ่ายรายเดือน.dc.html

export type RecordType = "FA017" | "FA018";

export interface EmployeeSnapshot {
  name: string;
  position: string;
  department: string;
  office: string;
  employeeNo: string;
  projectCC: string;
}

// A saved-for-reuse employee entry as it comes back from the database (see
// prisma/schema.prisma's SavedEmployee) — an EmployeeSnapshot plus the row's
// `id`, needed to delete a specific saved entry (name is a lookup/display
// key, not a stable id — re-saving under the same name updates the row in
// place rather than creating a new one, but the id is what a delete action
// actually targets).
export interface SavedEmployeeEntry extends EmployeeSnapshot {
  id: string;
}

export interface FA018Item {
  date: string;
  desc: string;
  projectNo: string;
  amount: string;
}

export interface FA017Item {
  date: string;
  desc: string;
  receipt: string; // "" | "Y" | "N"
  projectCC: string;
  gasoline: string;
  hotel: string;
  entertain: string;
  mobile: string;
  transport: string;
  other: string;
  localAmt: string;
}

export type DraftItem = FA018Item | FA017Item;

// The union of every field name across both item shapes. `updateItem`
// callbacks take this instead of `keyof DraftItem` because TypeScript
// narrows `keyof (A | B)` down to only the fields shared by both variants.
export type ItemField = keyof FA018Item | keyof FA017Item;

// The in-progress form being edited on the client, before it's saved.
export interface Draft {
  id: string | null;
  // The updatedAt this draft was loaded with (null for a brand-new,
  // unsaved draft) — saveRecord (actions/records.ts) uses it as an
  // optimistic-locking token so that two people editing the same saved
  // record at once can't silently overwrite each other's changes.
  updatedAt: string | null;
  type: RecordType;
  day: number; // day-of-month for FA017's "DATE :" field; unused by FA018
  monthName: string;
  monthYear: number;
  employee: EmployeeSnapshot;
  remark: string;
  items: DraftItem[];
}

// A saved record as it comes back from the database (see prisma/schema.prisma).
export interface ExpenseRecordData {
  id: string;
  type: RecordType;
  day: number;
  monthName: string;
  monthYear: number;
  employeeName: string;
  employeePosition: string;
  employeeDepartment: string;
  employeeOffice: string;
  employeeNo: string;
  employeeProjectCC: string;
  remark: string;
  items: DraftItem[];
  total: string; // Decimal serialized as string across the server/client boundary
  // Who was logged in (see lib/auth.ts's SessionPayload.displayName) when
  // this record was created/last saved — "" for records saved before
  // per-user login existed. Not part of Draft: the client never sets these
  // directly, actions/records.ts stamps them from the current session.
  createdByName: string;
  updatedByName: string;
  createdAt: string;
  updatedAt: string;
}

// A reusable expense-item-row template (see prisma/schema.prisma's
// SavedItem model). `desc` is the lookup key, exactly like
// EmployeeSnapshot's `name` is for SavedEmployee — `data` holds every other
// FA017Item/FA018Item field except `date` (transaction-specific, not part
// of a reusable template) and `desc` itself (already its own field here).
// `id` is the row's actual id, needed to delete a specific saved entry
// (desc is a lookup/display key, not a stable id).
export interface SavedItemEntry {
  id: string;
  desc: string;
  data: Record<string, string>;
}

export function emptyItemFA018(): FA018Item {
  return { date: "", desc: "", projectNo: "", amount: "" };
}

export function emptyItemFA017(): FA017Item {
  return {
    date: "",
    desc: "",
    receipt: "",
    projectCC: "",
    gasoline: "",
    hotel: "",
    entertain: "",
    mobile: "",
    transport: "",
    other: "",
    localAmt: "",
  };
}

// Pads `items` with empty rows up to `minCount`, never truncates. Used when
// EntryFormFA017/018 hand a Draft off to BillEditor (see their handleCreate)
// so the printed form still shows a full page's worth of blank lines
// (DEFAULT_ROWS_FA017/018 in lib/constants.ts) regardless of how few rows
// the roomy on-screen entry form itself started with (PAGE_ROWS).
export function padItems<T>(items: T[], minCount: number, makeEmpty: () => T): T[] {
  if (items.length >= minCount) return items;
  return [...items, ...Array.from({ length: minCount - items.length }, makeEmpty)];
}

// Shared by FA017Form.tsx (blank-row display) and the entry-form components
// (finding the first blank row to prefill, e.g. from the travel-cost
// calculator's handoff) — a row counts as "untouched" only if every one of
// its fields is still blank.
export function isFA018ItemEmpty(it: FA018Item): boolean {
  return !it.date && !it.desc && !it.projectNo && !it.amount;
}

export function isFA017ItemEmpty(it: FA017Item): boolean {
  return (
    !it.date &&
    !it.desc &&
    !it.receipt &&
    !it.projectCC &&
    !it.gasoline &&
    !it.hotel &&
    !it.entertain &&
    !it.mobile &&
    !it.transport &&
    !it.other &&
    !it.localAmt
  );
}
