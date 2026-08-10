"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRecord, duplicateRecord } from "@/actions/records";
import { fmt } from "@/lib/format";
import { THAI_MONTHS } from "@/lib/constants";
import type { ExpenseRecordData } from "@/lib/types";

type SortKey = "type" | "month" | "employee" | "total";
type SortDir = "asc" | "desc";

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  borderBottom: "1px solid #d8d5cc",
};

const sortableTh: React.CSSProperties = {
  ...th,
  cursor: "pointer",
  userSelect: "none",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = { padding: "10px 14px" };

const actionBtn: React.CSSProperties = {
  marginRight: 6,
  padding: "5px 10px",
  border: "1px solid #1c1c1c",
  borderRadius: 4,
  background: "#fff",
  font: "inherit",
  fontSize: 12,
  cursor: "pointer",
};

const deleteBtn: React.CSSProperties = {
  ...actionBtn,
  marginRight: 0,
  border: "1px solid #b3261e",
  color: "#b3261e",
};

function typeLabel(type: ExpenseRecordData["type"]) {
  return type === "FA017"
    ? "F-FA-017 Employee Expense Claim"
    : "F-FA-018 ค่าใช้จ่ายไม่มีบิล";
}

// Ported from the history table in the design source (the `isHistory` sc-if
// block: <table> of records + edit/duplicate/delete actions + empty state).
export default function RecordsTable({
  records,
}: {
  records: ExpenseRecordData[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
      return;
    }
    // Same column clicked again: asc -> desc -> off (back to original order).
    if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
    }
  }

  function sortArrow(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  // Filtering + sorting happen on the already-fetched `records` prop (this
  // app's record counts are small — a handful of bills per month — so no
  // need to push either back to the server/DB). Sorted list is recomputed
  // from scratch each time rather than mutating `records` in place.
  const visibleRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? records.filter((rec) => {
          const haystack = [
            typeLabel(rec.type),
            rec.employeeName,
            rec.employeeNo,
            rec.monthName,
            String(rec.monthYear),
            `${rec.monthName}/${rec.monthYear}`,
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(q);
        })
      : records;

    if (!sortKey) return filtered;

    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "type":
          return typeLabel(a.type).localeCompare(typeLabel(b.type), "th") * dir;
        case "employee":
          return a.employeeName.localeCompare(b.employeeName, "th") * dir;
        case "total":
          return (parseFloat(a.total) - parseFloat(b.total)) * dir;
        case "month": {
          if (a.monthYear !== b.monthYear) return (a.monthYear - b.monthYear) * dir;
          const ai = THAI_MONTHS.indexOf(a.monthName as (typeof THAI_MONTHS)[number]);
          const bi = THAI_MONTHS.indexOf(b.monthName as (typeof THAI_MONTHS)[number]);
          return (ai - bi) * dir;
        }
      }
    });
  }, [records, query, sortKey, sortDir]);

  function onEdit(id: string) {
    router.push(`/bill/${id}`);
  }

  function onDuplicate(id: string) {
    setPendingId(id);
    startTransition(async () => {
      await duplicateRecord(id);
      setPendingId(null);
      router.refresh();
    });
  }

  function onDelete(id: string) {
    if (typeof window !== "undefined" && !window.confirm("ลบรายการนี้ใช่หรือไม่?")) {
      return;
    }
    setPendingId(id);
    startTransition(async () => {
      await deleteRecord(id);
      setPendingId(null);
      router.refresh();
    });
  }

  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาชื่อพนักงาน, ประเภทฟอร์ม, เดือน..."
        style={{
          padding: "9px 12px",
          border: "1px solid #ccc",
          borderRadius: 6,
          font: "inherit",
          fontSize: 13,
        }}
      />
      <div
        style={{
          background: "#fff",
          border: "1px solid #d8d5cc",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f4f2ec" }}>
              <th style={sortableTh} onClick={() => toggleSort("type")}>
                ประเภทฟอร์ม{sortArrow("type")}
              </th>
              <th style={sortableTh} onClick={() => toggleSort("month")}>
                ประจำเดือน{sortArrow("month")}
              </th>
              <th style={sortableTh} onClick={() => toggleSort("employee")}>
                ชื่อพนักงาน{sortArrow("employee")}
              </th>
              <th style={{ ...sortableTh, textAlign: "right" }} onClick={() => toggleSort("total")}>
                ยอดรวม{sortArrow("total")}
              </th>
              <th style={{ ...th, textAlign: "center", width: 220 }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {visibleRecords.map((rec) => (
              <tr key={rec.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={td}>{typeLabel(rec.type)}</td>
                <td style={td}>
                  {rec.monthName}/{rec.monthYear}
                </td>
                <td style={td}>{rec.employeeName}</td>
                <td
                  style={{
                    ...td,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmt(rec.total)}
                </td>
                <td style={{ padding: "8px 14px", textAlign: "center", whiteSpace: "nowrap" }}>
                  <button
                    onClick={() => onEdit(rec.id)}
                    disabled={pendingId === rec.id}
                    style={actionBtn}
                  >
                    แก้ไข
                  </button>
                  <button
                    onClick={() => onDuplicate(rec.id)}
                    disabled={pendingId === rec.id}
                    style={actionBtn}
                  >
                    ทำซ้ำ
                  </button>
                  <button
                    onClick={() => onDelete(rec.id)}
                    disabled={pendingId === rec.id}
                    className="btn-danger"
                    style={deleteBtn}
                  >
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "#888", fontSize: 13 }}>
            ยังไม่มีรายการ กดปุ่มด้านบนเพื่อสร้างบิลใหม่
          </div>
        )}
        {records.length > 0 && visibleRecords.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "#888", fontSize: 13 }}>
            ไม่พบรายการที่ตรงกับคำค้นหา
          </div>
        )}
      </div>
    </div>
  );
}
