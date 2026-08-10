// The outer padded canvas every screen sits on, ported from the design
// source's top-level <div style="min-height:100vh;background:#e7e5e0;padding:24px;...">
export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    // page-shell's 24px padding is screen-only (see globals.css's print
    // override) — .paper is already sized to the FULL physical page width
    // (PAPER_WIDTH_FA017/FA018), so this padding pushed it 24px right of
    // the true page origin on print, overflowing the right edge by exactly
    // that much. .paper's own inner padding provides the visible margin
    // once this outer padding is gone for print.
    <div
      className="page-shell"
      style={{
        minHeight: "100vh",
        background: "#e7e5e0",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}
