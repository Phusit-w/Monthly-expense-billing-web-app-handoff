"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRecord, duplicateRecord } from "@/actions/records";
import { fmt } from "@/lib/format";
import { THAI_MONTHS } from "@/lib/constants";
import { downloadBillingPdf } from "@/lib/downloadBillingPdf";
import type { ExpenseRecordData, RecordType } from "@/lib/types";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ConfirmDialog";
import { SearchIcon } from "@/components/icons";

type SortKey = "type" | "month" | "employee" | "total";
type SortDir = "asc" | "desc";
type TypeFilter = "all" | RecordType;

function typeLabel(type: ExpenseRecordData["type"]) {
  return type === "FA017"
    ? "F-FA-017 Employee Expense Claim"
    : "F-FA-018 ค่าใช้จ่ายไม่มีบิล";
}

const th =
  "px-3.5 pb-3 text-left text-xs font-medium text-muted whitespace-nowrap";

export default function RecordsTable({
  records,
}: {
  records: ExpenseRecordData[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pdfPendingId, setPdfPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );

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
  // need to push either back to the server/DB).
  const visibleRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = records;
    if (typeFilter !== "all") {
      filtered = filtered.filter((r) => r.type === typeFilter);
    }
    if (q) {
      filtered = filtered.filter((rec) => {
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
      });
    }

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
          if (a.monthYear !== b.monthYear)
            return (a.monthYear - b.monthYear) * dir;
          const ai = THAI_MONTHS.indexOf(
            a.monthName as (typeof THAI_MONTHS)[number],
          );
          const bi = THAI_MONTHS.indexOf(
            b.monthName as (typeof THAI_MONTHS)[number],
          );
          return (ai - bi) * dir;
        }
      }
    });
  }, [records, query, typeFilter, sortKey, sortDir]);

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

  async function onDownloadPdf(record: ExpenseRecordData) {
    if (pdfPendingId) return;
    setPdfPendingId(record.id);
    try {
      await downloadBillingPdf(record.id, record.type);
    } catch (error) {
      const message = error instanceof Error ? error.message : "สร้าง PDF ไม่สำเร็จ";
      window.alert(`${message}\n\nกรุณาใช้ปุ่ม “พิมพ์ PDF” เป็นทางสำรอง`);
    } finally {
      setPdfPendingId(null);
    }
  }

  function onPrintPdf(id: string) {
    window.open(`/bill/${encodeURIComponent(id)}?print=1`, "_blank", "noopener,noreferrer");
  }

  function confirmDelete() {
    const id = confirmingDeleteId;
    if (!id) return;
    setConfirmingDeleteId(null);
    setPendingId(id);
    startTransition(async () => {
      await deleteRecord(id);
      setPendingId(null);
      router.refresh();
    });
  }

  const recordPendingDelete =
    records.find((r) => r.id === confirmingDeleteId) ?? null;

  const filters: { key: TypeFilter; label: string }[] = [
    { key: "all", label: "ทั้งหมด" },
    { key: "FA017", label: "F-FA-017" },
    { key: "FA018", label: "F-FA-018" },
  ];

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[280px] max-w-[420px] flex-1 items-center gap-2.5 rounded-field border border-line px-4 py-2.5">
          <SearchIcon size={18} className="shrink-0 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อพนักงาน, ประเภทฟอร์ม, เดือน..."
            className="w-full border-0 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
          />
        </div>
        <div className="ml-auto flex gap-1.5 rounded-field bg-chip p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setTypeFilter(f.key)}
              className={`ui-btn rounded-[11px] px-4 py-2 text-[13px] font-medium transition-colors ${
                typeFilter === f.key
                  ? "bg-ink text-ground"
                  : "text-muted hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              <th
                className={`${th} cursor-pointer select-none`}
                onClick={() => toggleSort("type")}
              >
                ประเภทฟอร์ม{sortArrow("type")}
              </th>
              <th
                className={`${th} cursor-pointer select-none`}
                onClick={() => toggleSort("month")}
              >
                ประจำเดือน{sortArrow("month")}
              </th>
              <th
                className={`${th} cursor-pointer select-none`}
                onClick={() => toggleSort("employee")}
              >
                ชื่อพนักงาน{sortArrow("employee")}
              </th>
              <th
                className={`${th} cursor-pointer select-none text-right`}
                onClick={() => toggleSort("total")}
              >
                ยอดรวม{sortArrow("total")}
              </th>
              <th className={th}>แก้ไขล่าสุดโดย</th>
              <th className={`${th} min-w-[480px] text-right`}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {visibleRecords.map((rec) => (
              <tr key={rec.id}>
                <td className="border-t border-divider p-3.5 font-medium">
                  {typeLabel(rec.type)}
                </td>
                <td className="border-t border-divider p-3.5 text-label">
                  {rec.monthName}/{rec.monthYear}
                </td>
                <td className="border-t border-divider p-3.5">
                  {rec.employeeName}
                </td>
                <td className="border-t border-divider p-3.5 text-right font-medium tabular-nums">
                  {fmt(rec.total)}
                </td>
                <td
                  className={`border-t border-divider p-3.5 ${rec.updatedByName ? "text-label" : "text-muted"}`}
                >
                  {rec.updatedByName || "-"}
                </td>
                <td className="border-t border-divider px-3.5 py-2.5">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="billing-pdf-download whitespace-nowrap border-ink text-ink"
                      onClick={() => onDownloadPdf(rec)}
                      disabled={pdfPendingId !== null || pendingId === rec.id}
                    >
                      {pdfPendingId === rec.id ? "กำลังสร้าง PDF…" : "ดาวน์โหลด PDF"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="whitespace-nowrap"
                      onClick={() => onPrintPdf(rec.id)}
                      disabled={pendingId === rec.id}
                    >
                      พิมพ์ PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(rec.id)}
                      disabled={pendingId === rec.id}
                    >
                      แก้ไข
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDuplicate(rec.id)}
                      disabled={pendingId === rec.id}
                    >
                      ทำซ้ำ
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setConfirmingDeleteId(rec.id)}
                      disabled={pendingId === rec.id}
                    >
                      ลบ
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {records.length === 0 && (
        <div className="py-8 text-center text-[13px] text-muted">
          ยังไม่มีรายการ กดปุ่มด้านบนเพื่อสร้างบิลใหม่
        </div>
      )}
      {records.length > 0 && visibleRecords.length === 0 && (
        <div className="py-8 text-center text-[13px] text-muted">
          ไม่พบรายการที่ตรงกับคำค้นหา
        </div>
      )}

      <ConfirmDialog
        open={confirmingDeleteId !== null}
        title="ลบรายการ"
        message={
          recordPendingDelete
            ? `ลบรายการ "${typeLabel(recordPendingDelete.type)} — ${recordPendingDelete.employeeName || "-"} (${recordPendingDelete.monthName} ${recordPendingDelete.monthYear})" ใช่หรือไม่? การลบนี้ย้อนกลับไม่ได้`
            : ""
        }
        confirmLabel="ลบ"
        danger
        busy={pendingId !== null}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmingDeleteId(null)}
      />
    </Card>
  );
}
