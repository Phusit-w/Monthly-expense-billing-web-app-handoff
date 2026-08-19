"use client";

import { useEffect } from "react";

// Same overlay/dialog shell as ConfirmSaveModal.tsx (kept as a separate
// component rather than generalizing the two into one — this one has no
// rows table, just a yes/no question, so sharing would mean threading an
// unused `rows` prop through here for no benefit).
export default function ConfirmLogoutModal({
  open,
  loggingOut,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  loggingOut: boolean;
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
        aria-labelledby="confirm-logout-heading"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 8,
          padding: "22px 24px",
          width: "min(90vw, 360px)",
          boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
        }}
      >
        <div id="confirm-logout-heading" style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
          ยืนยันการออกจากระบบ
        </div>
        <div style={{ fontSize: 13, color: "#555", marginBottom: 18 }}>
          ต้องการออกจากระบบตอนนี้ใช่หรือไม่?
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loggingOut}
            style={{
              padding: "9px 16px",
              border: "1px solid #999",
              borderRadius: 6,
              background: "#fff",
              font: "inherit",
              fontWeight: 600,
              cursor: loggingOut ? "not-allowed" : "pointer",
              opacity: loggingOut ? 0.6 : 1,
            }}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loggingOut}
            style={{
              padding: "9px 16px",
              border: "1px solid #1c1c1c",
              borderRadius: 6,
              background: "#1c1c1c",
              color: "#fff",
              font: "inherit",
              fontWeight: 600,
              cursor: loggingOut ? "not-allowed" : "pointer",
              opacity: loggingOut ? 0.6 : 1,
            }}
          >
            {loggingOut ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}
          </button>
        </div>
      </div>
    </div>
  );
}
