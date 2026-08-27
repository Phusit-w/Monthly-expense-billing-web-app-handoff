"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavItemActive } from "@/lib/nav";
import { BellIcon, ChevronRightIcon } from "@/components/icons";

// The redesign's top bar: a breadcrumb on the left, a notification bell and
// the signed-in user's avatar on the right. Notifications are not a real
// feature yet — the bell is inert with a static unread dot, matching the
// mockup; wire it up when a notification source exists.

function crumbForPath(pathname: string): string {
  const navMatch = NAV_ITEMS.find((i) => isNavItemActive(i, pathname));
  if (navMatch) return navMatch.label;
  // Routes with no sidebar entry (the pixel-perfect bill editor).
  if (pathname.startsWith("/bill/")) return "แก้ไขบิล";
  return "";
}

function initials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] ?? "") + (parts[1][0] ?? "");
}

export default function AppTopBar({ displayName }: { displayName: string | null }) {
  const pathname = usePathname();
  const crumb = crumbForPath(pathname);

  return (
    <div className="no-print flex items-center gap-5">
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <span>หน้าหลัก</span>
        {crumb ? (
          <>
            <ChevronRightIcon size={14} />
            <span className="font-medium text-ink">{crumb}</span>
          </>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-3.5">
        <button
          type="button"
          aria-label="การแจ้งเตือน"
          className="ui-btn relative grid size-11 place-items-center rounded-field bg-chip text-ink transition-colors hover:bg-hover"
        >
          <BellIcon size={20} />
          <span className="absolute right-2.5 top-2.5 size-2 rounded-full border-2 border-chip bg-accent" />
        </button>

        <div className="flex items-center gap-2.5">
          <span className="grid size-11 place-items-center rounded-full bg-peach text-sm font-bold text-ink">
            {initials(displayName ?? "")}
          </span>
          {displayName ? (
            <span className="text-sm font-medium text-ink">{displayName}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
