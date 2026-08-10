"use client";

import { useState } from "react";
import BillEditor from "@/components/BillEditor";
import EntryFormFA017 from "@/components/EntryFormFA017";
import EntryFormFA018 from "@/components/EntryFormFA018";
import Header from "@/components/Header";
import PageShell from "@/components/PageShell";
import type { Draft, EmployeeSnapshot, RecordType, SavedEmployeeEntry, SavedItemEntry } from "@/lib/types";

// Glue between the friendly entry forms and the existing (untouched)
// BillEditor: rather than navigating to /bill/new/[type] and fighting that
// route's always-empty server-built Draft with a client-side rehydration
// (sessionStorage + effect + a visible empty→populated flash), this just
// swaps *what renders* in place. handoffDraft stays null until the entry
// form's "สร้างฟอร์ม" button fires; once set, BillEditor takes over exactly
// as if it had been given that Draft from a Server Component all along —
// its save/print/toolbar logic needs zero awareness of where the Draft
// came from. Tradeoff: the URL stays on /bill/entry/[type] through
// review/print/save rather than switching to /bill/new/[type] — acceptable
// here since a refresh mid-entry on /bill/new/[type] already loses an
// unsaved draft too (it just rebuilds empty), so this isn't a regression.
export default function EntryFlow({
  type,
  profile,
  savedEmployees,
  savedItems,
}: {
  type: RecordType;
  profile: EmployeeSnapshot;
  savedEmployees: SavedEmployeeEntry[];
  savedItems: SavedItemEntry[];
}) {
  const [handoffDraft, setHandoffDraft] = useState<Draft | null>(null);

  if (handoffDraft) {
    return <BillEditor initialDraft={handoffDraft} savedItems={savedItems} />;
  }

  return (
    <PageShell>
      <Header />
      {type === "FA018" ? (
        <EntryFormFA018
          profile={profile}
          savedEmployees={savedEmployees}
          savedItems={savedItems}
          onCreate={setHandoffDraft}
        />
      ) : (
        <EntryFormFA017
          profile={profile}
          savedEmployees={savedEmployees}
          savedItems={savedItems}
          onCreate={setHandoffDraft}
        />
      )}
    </PageShell>
  );
}
