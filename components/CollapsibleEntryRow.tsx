"use client";

import type { ReactNode } from "react";

// One expense-line card in the roomy entry forms (EntryFormFA017 /
// EntryFormFA018), made collapsible so a long list of rows can be scanned
// and managed without every field on screen at once. Click the header bar
// to show/hide that row's fields. `ui-btn` opts the bar out of globals.css's
// force-black button-hover rule; it carries its own subtle hover instead.
export default function CollapsibleEntryRow({
  index,
  collapsed,
  onToggle,
  summary,
  trailing,
  children,
}: {
  index: number;
  collapsed: boolean;
  onToggle: () => void;
  // Shown in the header bar when collapsed (and alongside #n when open) —
  // typically the row's Description, or a "still blank" hint.
  summary: ReactNode;
  // Optional right-aligned extra in the header bar, e.g. the row total.
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-field border border-line text-[13px]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        title={collapsed ? "ขยายรายการนี้" : "ย่อรายการนี้"}
        className="ui-btn flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-hover"
      >
        <span
          aria-hidden
          className={`shrink-0 text-[10px] text-muted transition-transform ${collapsed ? "" : "rotate-90"}`}
        >
          ▶
        </span>
        <span className="shrink-0 font-bold text-muted">#{index + 1}</span>
        <span className="min-w-0 flex-1 truncate text-subtle">{summary}</span>
        {trailing != null && <span className="shrink-0 text-label">{trailing}</span>}
      </button>
      {!collapsed && <div className="border-t border-line p-3.5">{children}</div>}
    </div>
  );
}
