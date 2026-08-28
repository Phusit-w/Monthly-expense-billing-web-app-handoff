import { rm } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/authorization";
import { requireSocActor, socStorageRoot, storeSocFile, validateEvidenceCount, validateEvidenceTotalSize, validateUpload } from "@/lib/soc";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let jobId: string | null = null;
  try {
    const actor = await requireSocActor();
    const form = await request.formData();
    const title = String(form.get("title") || "").trim();
    const soc = form.get("soc");
    const evidence = form.getAll("evidence").filter((v): v is File => v instanceof File && v.size > 0);
    if (!title || title.length > 160) return NextResponse.json({ error: "กรุณาระบุชื่อโครงการไม่เกิน 160 ตัวอักษร" }, { status: 400 });
    if (!(soc instanceof File)) return NextResponse.json({ error: "กรุณาแนบไฟล์ SOC" }, { status: 400 });
    validateEvidenceCount(evidence.length);
    validateEvidenceTotalSize(evidence);
    const socBytes = await validateUpload(soc, "SOC");
    const evidenceBytes = await Promise.all(evidence.map((file) => validateUpload(file, "EVIDENCE")));
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const job = await prisma.socJob.create({ data: { title, ownerId: actor.id, expiresAt } });
    jobId = job.id;
    const storedSoc = await storeSocFile(job.id, soc.name, ".docx", socBytes);
    const storedEvidence = await Promise.all(evidence.map((file, i) => storeSocFile(job.id, file.name, ".pdf", evidenceBytes[i])));
    await prisma.$transaction([
      prisma.socDocument.create({ data: { jobId: job.id, type: "SOC", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ...storedSoc } }),
      ...storedEvidence.map((stored) => prisma.socDocument.create({ data: { jobId: job.id, type: "EVIDENCE", mimeType: "application/pdf", ...stored } })),
      prisma.socJob.update({ where: { id: job.id }, data: { status: "QUEUED", stage: "รอคิวตรวจสอบ", progress: 5 } }),
      prisma.socAuditEvent.create({ data: { jobId: job.id, actorId: actor.id, action: "JOB_CREATED", detail: { evidenceCount: evidence.length } } }),
    ]);
    await writeAudit({ actorId: actor.id, action: "SOC_CREATED", entityType: "SOC_JOB", entityId: job.id, summary: `สร้างงาน SOC ${title}`, metadata: { evidenceCount: evidence.length } });
    return NextResponse.json({ id: job.id }, { status: 201 });
  } catch (error) {
    if (jobId) {
      await prisma.socJob.delete({ where: { id: jobId } }).catch(() => undefined);
      await rm(`${socStorageRoot()}/${jobId}`, { recursive: true, force: true }).catch(() => undefined);
    }
    const message = error instanceof Error ? error.message : "ไม่สามารถสร้างงานตรวจได้";
    const status = message === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
