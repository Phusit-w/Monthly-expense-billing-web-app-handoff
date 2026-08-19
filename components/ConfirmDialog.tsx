"use client";

import { useEffect } from "react";

// Generic yes/no modal — used in place of window.confirm() wherever a
// destructive action (currently: SavedListManager's "ลบ") needs an explicit
// confirmation step. See ConfirmSaveModal.tsx for the save-flow's own
// (richer, summary-row) confirmation modal; this one is the plain
// title+message version for everything else.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // Red confirm button, for destructive actions like delete.
  danger?: boolean;
  busy?: boolean;
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
        aria-labelledby="confirm-dialog-heading"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 8,
          padding: "22px 24px",
          width: "min(90vw, 380px)",
          boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
        }}
      >
        <div id="confirm-dialog-heading" style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: "#555", marginBottom: 18, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: "9px 16px",
              border: "1px solid #999",
              borderRadius: 6,
              background: "#fff",
              font: "inherit",
              fontWeight: 600,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={
              danger
                ? {
                    padding: "9px 16px",
                    border: "1px solid #b3261e",
                    borderRadius: 6,
                    background: "#b3261e",
                    color: "#fff",
                    font: "inherit",
                    fontWeight: 600,
                    cursor: busy ? "not-allowed" : "pointer",
                    opacity: busy ? 0.6 : 1,
                  }
                : {
                    padding: "9px 16px",
                    border: "1px solid #1c1c1c",
                    borderRadius: 6,
                    background: "#1c1c1c",
                    color: "#fff",
                    font: "inherit",
                    fontWeight: 600,
                    cursor: busy ? "not-allowed" : "pointer",
                    opacity: busy ? 0.6 : 1,
                  }
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
