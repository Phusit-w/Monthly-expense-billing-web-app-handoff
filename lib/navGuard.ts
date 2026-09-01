// Cross-component "there are unsaved edits" flag for the app shell.
//
// The bill editor (BillEditor.tsx) and the friendly entry forms
// (EntryFormFA017/FA018.tsx) keep everything the user typed in local React
// state until "บันทึก" writes it to the DB. Leaving via the app-shell
// sidebar (AppSidebar.tsx) or the browser Back button would drop that
// in-progress work — the sessionStorage autosave repopulates it on return,
// but silently, and the user still expects an "are you sure?".
//
// Those components sit in different parts of the tree whose only shared
// client ancestor is the persistent <AppSidebar>, so a plain module store
// read through useSyncExternalStore is simpler than threading context down
// through the async server layout.
//
// Ref-counted by an opaque token (useId) because EntryFlow.tsx keeps the
// entry form mounted *and* mounts BillEditor alongside it during review —
// two independent armers for the same URL. dirty = at least one is armed.

const armed = new Map<string, string>(); // token -> returnHref (URL "stay" goes back to)

export type NavGuardSnapshot = { dirty: boolean; returnHref: string };

// One frozen reference for the "nothing armed" state so useSyncExternalStore
// sees a stable snapshot on the server and between real changes.
const CLEAN: NavGuardSnapshot = { dirty: false, returnHref: "" };
let snapshot: NavGuardSnapshot = CLEAN;

const listeners = new Set<() => void>();

function recompute() {
  const dirty = armed.size > 0;
  const returnHref = dirty ? ([...armed.values()][0] ?? "") : "";
  if (dirty === snapshot.dirty && returnHref === snapshot.returnHref) return;
  snapshot = dirty ? { dirty, returnHref } : CLEAN;
  for (const listener of listeners) listener();
}

export function armNavGuard(token: string, returnHref: string) {
  if (armed.get(token) === returnHref) return;
  armed.set(token, returnHref);
  recompute();
}

export function disarmNavGuard(token: string) {
  if (armed.delete(token)) recompute();
}

// Used by AppSidebar once the user has confirmed they want to leave: clears
// every armer at once (BillEditor + entry form can both be armed) so the
// follow-up navigation isn't re-blocked.
export function disarmAllNavGuards() {
  if (armed.size === 0) return;
  armed.clear();
  recompute();
}

export function getNavGuardSnapshot(): NavGuardSnapshot {
  return snapshot;
}

export function getNavGuardServerSnapshot(): NavGuardSnapshot {
  return CLEAN;
}

export function subscribeNavGuard(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
