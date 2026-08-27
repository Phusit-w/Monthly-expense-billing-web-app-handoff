"use client";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

// Confirmation modal shown when "บันทึก" is clicked in EditorToolbar, before
// BillEditor actually calls saveRecord — a last look at what's about to be
// written (form type, employee, month, total). Closing only dismisses;
// nothing typed is lost (the draft lives in BillEditor's state).
export default function ConfirmSaveModal({
  open,
  heading,
  rows,
  saving,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  heading: string;
  rows: { label: string; value: string }[];
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      labelledBy="confirm-save-heading"
      width={420}
    >
      <div
        id="confirm-save-heading"
        className="font-display text-base font-bold text-ink"
      >
        ยืนยันการบันทึก
      </div>
      <div className="mb-3.5 mt-1 text-xs text-muted">{heading}</div>
      <div className="mb-5 rounded-field border border-line px-3 py-2.5 text-[13px]">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex justify-between gap-3 py-1"
          >
            <span className="text-label">{r.label}</span>
            <span className="text-right font-semibold">{r.value}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          ยกเลิก
        </Button>
        <Button variant="dark" size="sm" onClick={onConfirm} disabled={saving}>
          {saving ? "กำลังบันทึก…" : "ยืนยันบันทึก"}
        </Button>
      </div>
    </Modal>
  );
}
