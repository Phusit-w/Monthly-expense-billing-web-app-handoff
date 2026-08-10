"use client";

// Ported from the editor's top bar in the design source (ยกเลิก / พิมพ์ / PDF / บันทึก).
export default function EditorToolbar({
  paperWidth,
  heading,
  onCancel,
  onPrint,
  onSave,
  saving,
  addRow,
  removeLastRow,
}: {
  paperWidth: string;
  heading: string;
  onCancel: () => void;
  onPrint: () => void;
  onSave: () => void;
  saving: boolean;
  addRow: () => void;
  removeLastRow: () => void;
}) {
  const btn: React.CSSProperties = {
    padding: "9px 16px",
    borderRadius: 6,
    font: "inherit",
    fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <div
      className="no-print"
      style={{
        maxWidth: paperWidth,
        margin: "0 auto 12px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 13, color: "#555" }}>{heading}</div>
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
          }}
        >
          + เพิ่มแถว
        </button>
        <button
          onClick={removeLastRow}
          className="btn-danger"
          style={{ padding: "6px 14px", border: "1px solid #b3261e", color: "#b3261e", borderRadius: 4, background: "#fff", font: "inherit", fontSize: 12, cursor: "pointer" }}
        >
          − ลบแถว
        </button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
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
