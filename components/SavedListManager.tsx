"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import Button from "@/components/ui/Button";

// Small collapsed-by-default "manage saved entries" panel — a delete
// affordance for whichever list is passed in (saved expense-item rows via
// lib/useSavedItems.ts, or saved employees via actions/profile.ts).
// Renders nothing when there's nothing saved yet.
export default function SavedListManager({
  label,
  items,
  onDelete,
  className,
}: {
  label: string;
  items: { id: string; text: string }[];
  onDelete: (id: string) => Promise<void>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{
    id: string;
    text: string;
  } | null>(null);

  if (items.length === 0) return null;

  async function confirmDelete() {
    if (!confirming) return;
    const { id } = confirming;
    setConfirming(null);
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="ui-btn rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-medium text-label transition-colors hover:bg-hover"
      >
        จัดการ{label} ({items.length}) {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="mt-1.5 max-h-40 max-w-[360px] overflow-y-auto rounded-field border border-line px-2.5 py-1">
          {items.map((it) => (
            <div
              key={it.id}
              className="flex items-center justify-between gap-2.5 border-b border-divider py-1.5 text-xs last:border-b-0"
            >
              <span className="truncate">{it.text}</span>
              <Button
                variant="danger"
                size="sm"
                className="shrink-0 !h-7 !px-2.5 !text-[11px]"
                onClick={() => setConfirming({ id: it.id, text: it.text })}
                disabled={deletingId === it.id}
              >
                ลบ
              </Button>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={confirming !== null}
        title={`ลบ${label}`}
        message={
          confirming ? `ลบ "${confirming.text}" ที่บันทึกไว้ใช่หรือไม่?` : ""
        }
        confirmLabel="ลบ"
        danger
        busy={deletingId !== null}
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
