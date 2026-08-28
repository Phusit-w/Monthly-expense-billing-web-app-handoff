export const SOC_STATUSES = [
  "DRAFT", "QUEUED", "PROCESSING", "NEEDS_REVIEW", "CONFIRMED",
  "EXPORTING", "COMPLETED", "FAILED", "EXPIRED",
] as const;

export const SOC_CHECK_STATUSES = [
  "match", "mismatch", "review", "not_found", "unverifiable", "not_applicable",
] as const;

export const SOC_HEADING_STATUSES = [
  "match", "mismatch", "unverifiable", "not_applicable",
] as const;

export type SocCheckStatus = (typeof SOC_CHECK_STATUSES)[number];
export type SocHeadingStatus = (typeof SOC_HEADING_STATUSES)[number];

export const SOC_STATUS_LABELS: Record<string, string> = {
  DRAFT: "แบบร่าง", QUEUED: "รอประมวลผล", PROCESSING: "กำลังตรวจสอบ",
  NEEDS_REVIEW: "รอตรวจทาน", CONFIRMED: "ยืนยันแล้ว", EXPORTING: "กำลังสร้างเอกสาร",
  COMPLETED: "เสร็จสิ้น", FAILED: "เกิดข้อผิดพลาด", EXPIRED: "หมดอายุ",
};

export const CHECK_LABELS: Record<string, string> = {
  match: "ตรง", mismatch: "ไม่ตรง", review: "ต้องตรวจทาน", not_found: "ไม่พบเลขหน้า",
  unverifiable: "ยืนยันไม่ได้", not_applicable: "ไม่เกี่ยวข้อง",
};
