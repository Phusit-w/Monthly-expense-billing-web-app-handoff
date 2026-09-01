"use client";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

// The editor's top bar (Claude Design "Turn 4a" — a white rounded card
// above the untouched black-and-white A4 paper). See BillEditor.tsx for
// what each button does. "พิมพ์ / PDF" (onPrint) is the only way to get a
// PDF: the browser's print dialog has a "Save as PDF" destination that
// renders the sheet with Chrome's real layout engine. Former "ดาวน์โหลด
// PDF" (html2canvas), "← ย้อนกลับ" and "ยกเลิก" buttons were all removed;
// leaving the editor is now the browser Back (with its unsaved-changes
// guard) or the sidebar (the draft is autosaved either way).
export default function EditorToolbar({
  paperWidth,
  heading,
  auditLine,
  onPrint,
  onCreateFA018,
  onCreateFA017,
  onSave,
  saving,
  addRow,
  removeLastRow,
}: {
  paperWidth: string;
  heading: string;
  auditLine?: string;
  onPrint: () => void;
  // onCreateFA018 only for an FA017 draft, onCreateFA017 only for an FA018
  // draft — undefined hides that button entirely.
  onCreateFA018?: () => void;
  onCreateFA017?: () => void;
  onSave: () => void;
  saving: boolean;
  addRow: () => void;
  removeLastRow: () => void;
}) {
  return (
    <Card
      className="no-print mx-auto mb-3 flex flex-wrap items-center gap-3 p-4"
      style={{ maxWidth: paperWidth }}
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium">{heading}</span>
        {auditLine && (
          <span className="text-xs text-muted">{auditLine}</span>
        )}
      </div>

      <div className="flex gap-2">
        {/* No row cap — FA017Form/FA018Form paginate onto more A4 pages
            automatically once content overflows one. */}
        <button
          onClick={addRow}
          className="ui-btn whitespace-nowrap rounded-chip border border-dashed border-ink px-3.5 py-2 text-xs font-medium text-ink transition-colors hover:bg-hover"
        >
          + เพิ่มแถว
        </button>
        <Button
          variant="danger"
          size="sm"
          className="whitespace-nowrap"
          onClick={removeLastRow}
        >
          − ลบแถว
        </Button>
      </div>

      <div className="ml-auto flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="whitespace-nowrap border-ink text-ink"
          onClick={onPrint}
          title="เปิดหน้าต่างพิมพ์ของเบราว์เซอร์ — เลือกปลายทางเป็น “Save as PDF” เพื่อบันทึกเป็นไฟล์ PDF"
        >
          พิมพ์ / PDF
        </Button>
        {onCreateFA018 && (
          <button
            onClick={onCreateFA018}
            title="สร้างฟอร์มใบรับรองแทนใบเสร็จจากรายการชุดนี้ (วันที่, Description of Expenses, Project / CC, จำนวนเงิน)"
            className="ui-btn whitespace-nowrap rounded-input bg-lavender px-3.5 py-2 text-[13px] font-medium text-black transition-colors hover:brightness-95"
          >
            สร้างฟอร์มใบรับรองแทนใบเสร็จ →
          </button>
        )}
        {onCreateFA017 && (
          <button
            onClick={onCreateFA017}
            title="สร้างฟอร์ม Expense Claim จากรายการชุดนี้ (วันที่, รายการ, เลขที่โครงการ, จำนวนเงิน)"
            className="ui-btn whitespace-nowrap rounded-input bg-lavender px-3.5 py-2 text-[13px] font-medium text-black transition-colors hover:brightness-95"
          >
            สร้างฟอร์ม Expense Claim →
          </button>
        )}
        <Button
          variant="primary"
          size="sm"
          className="whitespace-nowrap"
          onClick={onSave}
          disabled={saving}
        >
          บันทึก
        </Button>
      </div>
    </Card>
  );
}
