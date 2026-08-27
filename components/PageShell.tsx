// The per-page content wrapper. Since the 2026 redesign, the min-height and
// page background live on the app shell (app/(app)/layout.tsx), not here —
// this now only carries the `.page-shell` class that globals.css's print
// block zeroes out, plus a small amount of bottom breathing room. The
// not-yet-restyled screens (History, entry forms, travel) still render
// their content inside this; they get their new look in a later pass.
export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell" style={{ paddingBottom: 24 }}>
      {children}
    </div>
  );
}
