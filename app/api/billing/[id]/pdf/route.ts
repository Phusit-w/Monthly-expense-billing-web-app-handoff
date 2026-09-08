import { chromium } from "playwright-core";
import { getRecord } from "@/actions/records";
import {
  billingPdfBaseUrl,
  billingPdfFilename,
  findPdfChromiumExecutable,
} from "@/lib/billingPdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = await getRecord(id);
  if (!record) return Response.json({ error: "ไม่พบรายการหรือไม่มีสิทธิ์เข้าถึง" }, { status: 404 });

  let browser;
  try {
    browser = await chromium.launch({
      executablePath: findPdfChromiumExecutable(),
      headless: true,
    });
    const cookie = request.headers.get("cookie") || "";
    const context = await browser.newContext({
      extraHTTPHeaders: cookie ? { cookie } : undefined,
    });
    const page = await context.newPage();
    const target = new URL(`/bill/${encodeURIComponent(id)}?pdf=1`, billingPdfBaseUrl());

    const response = await page.goto(target.toString(), {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    if (!response?.ok()) throw new Error(`เปิดหน้าเอกสารไม่สำเร็จ (${response?.status() || "no response"})`);

    await page.locator(".paper").first().waitFor({ state: "visible", timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: "print" });

    const pdf = await page.pdf({
      format: "A4",
      landscape: record.type === "FA017",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    const filename = billingPdfFilename(record.type, record.id);
    const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;

    return new Response(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "สร้าง PDF ไม่สำเร็จ";
    console.error("Billing PDF generation failed", { id, error });
    return Response.json({ error: message }, { status: 500 });
  } finally {
    await browser?.close();
  }
}
