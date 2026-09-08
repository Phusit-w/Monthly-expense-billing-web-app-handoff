import { existsSync } from "node:fs";
import path from "node:path";

function chromiumCandidates(): string[] {
  const candidates = [
    process.env.PDF_CHROMIUM_EXECUTABLE_PATH,
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
    process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Microsoft", "Edge", "Application", "msedge.exe"),
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
  ];

  return candidates.filter((candidate): candidate is string => Boolean(candidate));
}

export function findPdfChromiumExecutable(): string {
  const executable = chromiumCandidates().find(existsSync);
  if (!executable) {
    throw new Error(
      "ไม่พบ Chromium สำหรับสร้าง PDF กรุณาตั้งค่า PDF_CHROMIUM_EXECUTABLE_PATH หรือใช้ปุ่ม พิมพ์ / PDF"
    );
  }
  return executable;
}

export function billingPdfBaseUrl(): string {
  return process.env.PDF_BASE_URL || `http://127.0.0.1:${process.env.PORT || "3000"}`;
}

export function billingPdfFilename(type: "FA017" | "FA018", id: string): string {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "-");
  return `${type}-${safeId}.pdf`;
}

