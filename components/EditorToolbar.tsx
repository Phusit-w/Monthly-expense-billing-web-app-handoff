"use client";

// Ported from the editor's top bar in the design source (ยกเลิก / พิมพ์ / PDF / บันทึก).
// "ย้อนกลับ" (onBack) and "ดาวน์โหลด PDF" (onDownloadPdf) are later
// additions on top of that original set — see BillEditor.tsx's handleBack/
// handleDownloadPdf for what each actually does.
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
  // Audit trail line ("สร้างโดย ... · แก้ไขล่าสุดโดย ..."), see
  // BillEditor.tsx — undefined for a not-yet-saved draft.
  auditLine?: string;
  onBack: () => void;
  onCancel: () => void;
  onPrint: () => void;
  onDownloadPdf: () => void;
  downloadingPdf: boolean;
  // Only passed for an FA017 draft (see BillEditor.tsx) — undefined hides
  // the button entirely rather than disabling it, since "create an FA018
  // from this" has no meaning once you're already looking at one.
  onCreateFA018?: () => void;
  onSave: () => void;
  saving: boolean;
  addRow: () => void;
  removeLastRow: () => void;
}) {
  // whiteSpace: nowrap on every button below is deliberate: FA018's
  // paperWidth (794px) is too narrow to fit all 7 buttons on one line at
  // their natural size, so without this each button's own *label* would
  // wrap mid-word ("ย้อน"/"กลับ" on separate lines) once it got squeezed —
  // technically fits, but reads as broken. flexWrap on both groups below
  // means the fallback for "doesn't fit" is whole buttons dropping to a
  // second row instead, which still looks like a normal toolbar.
  const btn: React.CSSProperties = {
    padding: "9px 16px",
    borderRadius: 6,
    font: "inherit",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  return (
    <div
      className="no-print"
      style={{
        maxWidth: paperWidth,
        margin: "0 auto 12px",
        display: "flex",
        flexWrap: "wrap",
        rowGap: 8,
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", rowGap: 8, alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 13, color: "#555", whiteSpace: "nowrap" }}>{heading}</div>
        {auditLine && (
          <div style={{ fontSize: 12, color: "#888", whiteSpace: "nowrap" }}>{auditLine}</div>
        )}
        {/* No row cap — FA017Form/FA018Form paginate onto additional A4
            pages automatically once content overflows one (see
            components/BillEditor.tsx's addRow and lib/pagination.ts), so
            there's no "table full" state to disable this for anymore. */}
        <button
          onClick={addRow}
          style={{
            padding: "6px 14px",
            border: "1px dashed #1c1c1c",
            borderRadius: 4,
            background: "#fff",
            font: "inherit",
            fontSize: 12,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          + เพิ่มแถว
        </button>
        <button
          onClick={removeLastRow}
          className="btn-danger"
          style={{ padding: "6px 14px", border: "1px solid #b3261e", color: "#b3261e", borderRadius: 4, background: "#fff", font: "inherit", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          − ลบแถว
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", rowGap: 8, gap: 8 }}>
        <button
          onClick={onBack}
          title="กลับไปหน้ากรอกข้อมูล"
          style={{ ...btn, border: "1px solid #999", background: "#fff" }}
        >
          ← ย้อนกลับ
        </button>
        <button
          onClick={onCancel}
          style={{ ...btn, border: "1px solid #999", background: "#fff" }}
        >
          ยกเลิก
        </button>
        <button
          onClick={onPrint}
          style={{ ...btn, border: "1px solid #1c1c1c", background: "#fff" }}
        >
          พิมพ์ / PDF
        </button>
        <button
          onClick={onDownloadPdf}
          disabled={downloadingPdf}
          title="ดาวน์โหลดเป็นไฟล์ PDF โดยตรง (ไม่ต้องผ่านหน้าต่างพิมพ์)"
          style={{
            ...btn,
            border: "1px solid #1c1c1c",
            background: "#fff",
            opacity: downloadingPdf ? 0.6 : 1,
          }}
        >
          {downloadingPdf ? "กำลังสร้าง PDF…" : "ดาวน์โหลด PDF"}
        </button>
        {onCreateFA018 && (
          <button
            onClick={onCreateFA018}
            title="สร้างฟอร์มใบรับรองแทนใบเสร็จจากรายการชุดนี้ (วันที่, Description of Expenses, Project / CC, จำนวนเงิน)"
            style={{ ...btn, border: "1px solid #1c1c1c", background: "#fff" }}
          >
            สร้างฟอร์มใบรับรองแทนใบเสร็จ →
          </button>
        )}
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            ...btn,
            border: "1px solid #1c1c1c",
            background: "#1c1c1c",
            color: "#fff",
            opacity: saving ? 0.6 : 1,
          }}
        >
          บันทึก
        </button>
      </div>
    </div>
  );
}
