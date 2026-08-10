"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

// Ported from the nav block in the design source (the `notPrinting` sc-if at
// the top of the template). Hidden on print via the shared .no-print class.
export default function Header() {
  const pathname = usePathname();
  const isHistory = pathname === "/";
  const isTravel = pathname.startsWith("/travel");
  const isFA018Entry = pathname.startsWith("/bill/entry/fa018");
  const isFA017Entry = pathname.startsWith("/bill/entry/fa017");

  return (
    <div
      className="no-print"
      style={{
        maxWidth: 1160,
        margin: "0 auto 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Image
          src="/icn-logo.png"
          alt="ICN"
          height={34}
          width={140}
          style={{ height: 34, width: "auto" }}
          priority
        />
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1c1c1c" }}>
          ระบบบิลค่าใช้จ่ายรายเดือน
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link
          href="/"
          className="nav-btn"
          style={{
            padding: "9px 16px",
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
            padding: "9px 16px",
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
            padding: "9px 16px",
            border: "1px solid #1c1c1c",
            borderRadius: 6,
            background: isFA017Entry ? "#1c1c1c" : "#fff",
            color: isFA017Entry ? "#fff" : "#1c1c1c",
            fontWeight: 600,
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          + กรอกข้อมูล FA017
        </Link>
        <Link
          href="/bill/entry/fa018"
          className="nav-btn"
          style={{
            padding: "9px 16px",
            border: "1px solid #1c1c1c",
            borderRadius: 6,
            background: isFA018Entry ? "#1c1c1c" : "#fff",
            color: isFA018Entry ? "#fff" : "#1c1c1c",
            fontWeight: 600,
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          + กรอกข้อมูล FA018
        </Link>
      </div>
    </div>
  );
}
