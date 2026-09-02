"use client";

import { useLayoutEffect, useState } from "react";
import { billDraftKey, readBillDraft } from "@/lib/billDraftStorage";
import BillEditor from "@/components/BillEditor";
import EntryFormFA017 from "@/components/EntryFormFA017";
import EntryFormFA018 from "@/components/EntryFormFA018";
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
//
// The entry form itself is always mounted, never conditionally rendered —
// only hidden (display: none) once handoffDraft is set, with BillEditor
// rendered alongside it rather than replacing it. Originally this used an
// early `if (handoffDraft) return <BillEditor .../>`, which unmounted the
// entry form and threw away everything typed into it; "ย้อนกลับ" flipping
// handoffDraft back to null then remounted it empty. Keeping it mounted
// (just hidden) means its own state (EntryFormFA017/018's employee/items/
// etc.) survives the round trip untouched — "ย้อนกลับ" reveals it exactly
// as it was left, no serialization of that state needed.
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
  // handoffDraft's type doesn't have to match this EntryFlow's own `type`:
  // EntryFormFA017's "สร้างฟอร์ม FA018 →" button (its own onCreate prop,
  // wired the same as its regular "สร้างฟอร์ม" button) hands this a
  // FA018-typed Draft from *within* a type: "FA017" EntryFlow. BillEditor
  // picks FA017Form vs FA018Form from the draft's own .type, not from this
  // component's `type` prop, so that just works — and "ย้อนกลับ" un-hiding
  // *this* EntryFlow's entry form (always EntryFormFA017 here) is exactly
  // "go back to the FA017 page", for free.
  const [handoffDraft, setHandoffDraft] = useState<Draft | null>(null);

  // Reload recovery: if BillEditor stashed an unsaved review draft for this
  // tab (lib/billDraftStorage.ts), jump straight back into the review editor
  // with it — a reload otherwise remounts this component with handoffDraft
  // null and shows the empty entry form, losing everything. Both keys are
  // checked because EntryFormFA017's secondary button hands off a FA018
  // draft from a type: "FA017" flow. (This only recovers the *review* stage;
  // a draft still being typed into the friendly form above isn't persisted.)
  useLayoutEffect(() => {
    const saved =
      readBillDraft(billDraftKey({ id: null, type })) ??
      readBillDraft(billDraftKey({ id: null, type: type === "FA017" ? "FA018" : "FA017" }));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setHandoffDraft(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div style={{ display: handoffDraft ? "none" : undefined }}>
        <PageShell>
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
      </div>
      {handoffDraft && (
        // onBack: BillEditor's default "ย้อนกลับ" (router.push to this same
        // /bill/entry/[type] URL) would be a no-op here since the URL never
        // actually changed when this swap happened — flip handoffDraft back
        // to null instead, which just un-hides the entry form above again.
        <BillEditor
          initialDraft={handoffDraft}
          savedItems={savedItems}
          onBack={() => setHandoffDraft(null)}
        />
      )}
    </>
  );
}
