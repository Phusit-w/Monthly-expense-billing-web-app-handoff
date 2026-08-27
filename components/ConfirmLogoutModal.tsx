"use client";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

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
  return (
    <Modal
      open={open}
      onClose={onCancel}
      labelledBy="confirm-logout-heading"
      width={360}
    >
      <div
        id="confirm-logout-heading"
        className="mb-1 font-display text-base font-bold text-ink"
      >
        ยืนยันการออกจากระบบ
      </div>
      <div className="mb-5 text-sm text-subtle">
        ต้องการออกจากระบบตอนนี้ใช่หรือไม่?
      </div>
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={loggingOut}
        >
          ยกเลิก
        </Button>
        <Button
          variant="dark"
          size="sm"
          onClick={onConfirm}
          disabled={loggingOut}
        >
          {loggingOut ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}
        </Button>
      </div>
    </Modal>
  );
}
