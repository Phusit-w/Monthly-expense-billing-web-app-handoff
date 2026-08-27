"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { logout } from "@/actions/auth";
import { NAV_ITEMS, isNavItemActive } from "@/lib/nav";
import { LogOutIcon } from "@/components/icons";
import ConfirmLogoutModal from "@/components/ConfirmLogoutModal";

// The floating black navigation rail from the Claude Design mockup + the
// "Fix Floating Hover Sidebar" spec doc: fixed 24px inset, 24px radius,
// collapsed 80px, expands to 230px ON HOVER as an OVERLAY (z-index above the
// content, a dim scrim behind it) — the page shell reserves only the 80px
// collapsed width (see app/(app)/layout.tsx's 128px = 24+80+24 gutter), so
// expanding never reflows the page.
export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [loggingOut, startLogout] = useTransition();

  function handleConfirmLogout() {
    setConfirmingLogout(false);
    startLogout(async () => {
      await logout();
      router.push("/login");
      router.refresh();
    });
  }

  const labelStyle: React.CSSProperties = {
    opacity: expanded ? 1 : 0,
    transform: expanded ? "translateX(0)" : "translateX(-4px)",
    transition: "opacity 180ms ease, transform 180ms ease, color 150ms ease",
  };

  return (
    <>
      {/* Scrim over the page content while the rail is open. Hovering it
          counts as leaving the rail, so the rail collapses. */}
      <div
        aria-hidden
        onMouseEnter={() => setExpanded(false)}
        className="no-print fixed inset-0 z-[900] bg-black/35 transition-opacity duration-200"
        style={{
          opacity: expanded ? 1 : 0,
          pointerEvents: expanded ? "auto" : "none",
        }}
      />

      <nav
        aria-label="เมนูหลัก"
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        onFocusCapture={() => setExpanded(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setExpanded(false);
          }
        }}
        style={{
          width: expanded ? 230 : 80,
          transition: "width 220ms cubic-bezier(0.4,0,0.2,1)",
        }}
        className="no-print fixed inset-y-6 left-6 z-[1000] flex flex-col gap-5
          overflow-hidden rounded-shell bg-rail py-6 shadow-rail"
      >
        <div className="flex items-center justify-center px-4">
          <Image
            src="/icn-logo-white.png"
            alt="ICN"
            width={80}
            height={80}
            priority
            className="h-10 w-10 shrink-0 object-contain"
          />
        </div>

        <ul className="flex flex-col gap-2">
          {NAV_ITEMS.map((item) => {
            const active = isNavItemActive(item, pathname);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setExpanded(false)}
                  className="group flex items-center gap-3 px-4"
                >
                  <span
                    className={`grid size-12 shrink-0 place-items-center rounded-chip transition-colors
                      ${active ? "bg-white text-ink" : "bg-transparent text-[#8b8b8b] group-hover:bg-white group-hover:text-ink"}`}
                  >
                    <Icon size={22} />
                  </span>
                  <span
                    className={`whitespace-nowrap text-sm font-medium ${active ? "text-white" : "text-[#c9c9c9] group-hover:text-white"}`}
                    style={labelStyle}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => setConfirmingLogout(true)}
          disabled={loggingOut}
          title="ออกจากระบบ"
          className="ui-btn group mt-auto flex items-center gap-3 bg-transparent px-4 disabled:opacity-60"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-chip text-[#8b8b8b] transition-colors group-hover:bg-[#B3261E] group-hover:text-white">
            <LogOutIcon size={22} />
          </span>
          <span
            className="whitespace-nowrap text-sm font-medium text-[#c9c9c9] group-hover:text-[#B3261E]"
            style={labelStyle}
          >
            ออกจากระบบ
          </span>
        </button>
      </nav>

      <ConfirmLogoutModal
        open={confirmingLogout}
        loggingOut={loggingOut}
        onConfirm={handleConfirmLogout}
        onCancel={() => setConfirmingLogout(false)}
      />
    </>
  );
}
