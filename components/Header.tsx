"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { getCurrentUserInfo, logout } from "@/actions/auth";
import ConfirmLogoutModal from "@/components/ConfirmLogoutModal";

// Ported from the nav block in the design source (the `notPrinting` sc-if at
// the top of the template). Hidden on print via the shared .no-print class.
export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, startLogoutTransition] = useTransition();
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  // Fetched client-side on mount rather than threaded down as a prop from
  // each route's Server Component: Header is rendered from 4 different
  // places (2 client components 2 levels deep in some cases — see
  // EntryFlow.tsx/BillEditor.tsx), so a prop would mean touching every
  // route page.tsx plus every component in between just to show a name.
  // getCurrentUserInfo (actions/auth.ts) is the same kind of direct
  // server-action-from-client-component call handleLogout below already
  // makes for logout() itself.
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUserInfo().then((user) => setDisplayName(user?.displayName ?? null));
  }, []);

  function handleLogout() {
    startLogoutTransition(async () => {
      await logout();
      router.push("/login");
      router.refresh();
    });
  }

  function handleConfirmLogout() {
    setConfirmingLogout(false);
    handleLogout();
  }

  const isHistory = pathname === "/";
  const isTravel = pathname.startsWith("/travel");
  const isFA018Entry = pathname.startsWith("/bill/entry/fa018");
  const isFA017Entry = pathname.startsWith("/bill/entry/fa017");

  return (
    <div
      className="no-print"
      style={{
        // Wider than the 1160 the page content below uses (ProfileCard,
        // RecordsTable, EditorToolbar) — those aren't a shared layout grid
        // with this header, each just hardcodes its own 1160 independently,
        // so widening only this one doesn't break any alignment. Needed so
        // the logo/title plus the 4 nav links (รายการทั้งหมด/คำนวณค่าเดินทาง/
        // 2 entry-form links) fit on one row without wrapping — their
        // combined natural width is ~1230px, wider than 1160 alone.
        // (ออกจากระบบ used to be a 5th item counted into that same row; it
        // now sits under รายการทั้งหมด instead — see the column below.)
        maxWidth: 1280,
        margin: "0 auto 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ position: "relative", width: 77, height: 34, overflow: "hidden" }}>
          <Image
            src="/icn_logo-removebg-preview.png"
            alt="ICN"
            width={407}
            height={407}
            style={{ position: "absolute", top: -35, left: -14, width: 106, height: 106, maxWidth: "none" }}
            priority
          />
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1c1c1c" }}>
          ระบบบิลค่าใช้จ่ายรายเดือน
        </div>
      </div>
      {/* alignItems: "flex-start" (not the header's own "center") — this
          column is now taller than the logo/title block beside it (nav
          links row + the displayName/ออกจากระบบ row below), and
          center-aligning against that would shift the logo down to match
          instead of keeping it flush with the top of the nav links. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link
            href="/"
            className="nav-btn"
            style={{
              padding: "9px 13px",
              border: "1px solid #1c1c1c",
              borderRadius: 6,
              background: isHistory ? "#1c1c1c" : "#fff",
              color: isHistory ? "#fff" : "#1c1c1c",
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            รายการทั้งหมด
          </Link>
          <Link
            href="/travel"
            className="nav-btn"
            style={{
              padding: "9px 13px",
              border: "1px solid #1c1c1c",
              borderRadius: 6,
              background: isTravel ? "#1c1c1c" : "#fff",
              color: isTravel ? "#fff" : "#1c1c1c",
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            คำนวณค่าเดินทาง
          </Link>
          {/* EntryFlow (roomy data-entry page) is now the only way in — the
              old direct-to-compact-form links (/bill/new/fa017, /bill/new/fa018)
              were removed on request so people always fill in data here first,
              then adjust further in the compact table (BillEditor) afterward.
              FA017 comes first (right after "คำนวณค่าเดินทาง") per request. */}
          <Link
            href="/bill/entry/fa017"
            className="nav-btn"
            style={{
              padding: "9px 13px",
              border: "1px solid #1c1c1c",
              borderRadius: 6,
              background: isFA017Entry ? "#1c1c1c" : "#fff",
              color: isFA017Entry ? "#fff" : "#1c1c1c",
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            + กรอกข้อมูล Expense Claim
          </Link>
          <Link
            href="/bill/entry/fa018"
            className="nav-btn"
            style={{
              padding: "9px 13px",
              border: "1px solid #1c1c1c",
              borderRadius: 6,
              background: isFA018Entry ? "#1c1c1c" : "#fff",
              color: isFA018Entry ? "#fff" : "#1c1c1c",
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            + กรอกข้อมูลใบรับรองแทนใบเสร็จ
          </Link>
        </div>
        {/* displayName/logout on their own line below the nav links per
            request, rather than the old standalone "ออกจากระบบ" pushed to
            the row's far right (marginLeft: auto) — that button now lives
            here instead. */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#555" }}>
          {displayName && <span>{displayName}</span>}
          <button
            onClick={() => setConfirmingLogout(true)}
            disabled={loggingOut}
            className="nav-btn"
            style={{
              padding: "4px 10px",
              border: "1px solid #999",
              borderRadius: 6,
              background: "#fff",
              color: "#555",
              fontWeight: 600,
              fontSize: 12,
              font: "inherit",
              cursor: "pointer",
              opacity: loggingOut ? 0.6 : 1,
            }}
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
      <ConfirmLogoutModal
        open={confirmingLogout}
        loggingOut={loggingOut}
        onConfirm={handleConfirmLogout}
        onCancel={() => setConfirmingLogout(false)}
      />
    </div>
  );
}
