"use client";

import { useState } from "react";

// Small collapsed-by-default "manage saved entries" panel — a delete
// affordance for whichever list is passed in (saved expense-item rows via
// lib/useSavedItems.ts, or saved employees via actions/profile.ts). Both
// pickers that consume these lists elsewhere (a native <datalist> on the
// roomy entry forms, a native <select> on the compact print forms) are
// plain HTML controls with no way to attach a delete button to one of their
// own options, so deleting has to live in a separate small list like this
// one instead. Renders nothing when there's nothing saved yet.
export default function SavedListManager({
  label,
  items,
  onDelete,
  className,
}: {
  // e.g. "รายการที่บันทึกไว้" or "ชื่อที่บันทึกไว้" — used in both the
  // toggle button's text and each entry's delete-confirmation prompt.
  label: string;
  items: { id: string; text: string }[];
  onDelete: (id: string) => Promise<void>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (items.length === 0) return null;

  async function handleDelete(id: string, text: string) {
    if (typeof window !== "undefined" && !window.confirm(`ลบ "${text}" ที่บันทึกไว้ใช่หรือไม่?`)) {
      return;
    }
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          padding: "3px 8px",
          border: "1px dashed #999",
          borderRadius: 4,
          background: "#fff",
          font: "inherit",
          fontSize: 11,
          color: "#555",
          cursor: "pointer",
        }}
      >
        จัดการ{label} ({items.length}) {open ? "▲" : "▼"}
      </button>
      {open && (
        <div
          style={{
            marginTop: 6,
            border: "1px solid #e3e0d8",
            borderRadius: 4,
            padding: "4px 8px",
            maxWidth: 360,
            maxHeight: 160,
            overflowY: "auto",
          }}
        >
          {items.map((it) => (
            <div
              key={it.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                padding: "4px 0",
                fontSize: 12,
                borderBottom: "1px solid #f0efe9",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {it.text}
              </span>
              <button
                type="button"
                className="btn-danger"
                onClick={() => handleDelete(it.id, it.text)}
                disabled={deletingId === it.id}
                style={{
                  flexShrink: 0,
                  padding: "2px 8px",
                  border: "1px solid #b3261e",
                  color: "#b3261e",
                  borderRadius: 4,
                  background: "#fff",
                  font: "inherit",
                  fontSize: 11,
                  cursor: deletingId === it.id ? "not-allowed" : "pointer",
                  opacity: deletingId === it.id ? 0.5 : 1,
                }}
              >
                ลบ
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
