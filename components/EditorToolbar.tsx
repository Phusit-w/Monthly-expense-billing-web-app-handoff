"use client";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

// The editor's top bar (Claude Design "Turn 4a" — a white rounded card
// above the untouched black-and-white A4 paper). "ย้อนกลับ" (onBack) and
// "ดาวน์โหลด PDF" (onDownloadPdf) are later additions to the original
// ยกเลิก / พิมพ์ / บันทึก set — see BillEditor.tsx for what each does.
export default function EditorToolbar({
  paperWidth,
  heading,
  auditLine,
  onBack,
  onCancel,
  onPrint,
  onDownloadPdf,
  downloadingPdf,
  onCreateFA018,
  onSave,
  saving,
  addRow,
  removeLastRow,
}: {
  paperWidth: string;
  heading: string;
  auditLine?: string;
  onBack: () => void;
  onCancel: () => void;
  onPrint: () => void;
  onDownloadPdf: () => void;
  downloadingPdf: boolean;
  // Only passed for an FA017 draft — undefined hides the button entirely.
  onCreateFA018?: () => void;
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
          className="whitespace-nowrap"
          onClick={onBack}
          title="กลับไปหน้ากรอกข้อมูล"
        >
          ← ย้อนกลับ
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="whitespace-nowrap"
          onClick={onCancel}
        >
          ยกเลิก
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="whitespace-nowrap border-ink text-ink"
          onClick={onPrint}
        >
          พิมพ์ / PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="whitespace-nowrap border-ink text-ink"
          onClick={onDownloadPdf}
          disabled={downloadingPdf}
          title="ดาวน์โหลดเป็นไฟล์ PDF โดยตรง (ไม่ต้องผ่านหน้าต่างพิมพ์)"
        >
          {downloadingPdf ? "กำลังสร้าง PDF…" : "ดาวน์โหลด PDF"}
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
