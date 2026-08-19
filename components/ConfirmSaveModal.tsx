"use client";

import { useEffect } from "react";

// Confirmation modal shown when "บันทึก" is clicked in EditorToolbar, before
// BillEditor actually calls saveRecord — gives a last look at what's about
// to be written (form type, employee, month, total) so a stray click on
// "บันทึก" doesn't silently commit whatever's currently on screen. Closing
// (backdrop click, Escape, "ยกเลิก") only dismisses the modal — nothing typed
// in the form is lost either way, since the draft itself lives in BillEditor's
// state regardless of whether this is open.
export default function ConfirmSaveModal({
  open,
  heading,
  rows,
  saving,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  // e.g. "สร้างรายการใหม่" / "กำลังแก้ไขรายการ" (BillEditor's own `heading`).
  heading: string;
  rows: { label: string; value: string }[];
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="no-print"
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-save-heading"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 8,
          padding: "22px 24px",
          width: "min(90vw, 420px)",
          boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
        }}
      >
        <div id="confirm-save-heading" style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
          ยืนยันการบันทึก
        </div>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>{heading}</div>
        <div
          style={{
            border: "1px solid #e3e0d8",
            borderRadius: 6,
            padding: "10px 12px",
            marginBottom: 18,
            fontSize: 13,
          }}
        >
          {rows.map((r) => (
            <div
              key={r.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "4px 0",
              }}
            >
              <span style={{ color: "#555" }}>{r.label}</span>
              <span style={{ fontWeight: 600, textAlign: "right" }}>{r.value}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            style={{
              padding: "9px 16px",
              border: "1px solid #999",
              borderRadius: 6,
              background: "#fff",
              font: "inherit",
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            style={{
              padding: "9px 16px",
              border: "1px solid #1c1c1c",
              borderRadius: 6,
              background: "#1c1c1c",
              color: "#fff",
              font: "inherit",
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "กำลังบันทึก…" : "ยืนยันบันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}
