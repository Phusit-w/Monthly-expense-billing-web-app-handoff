import { notFound } from "next/navigation";
import SocJobDetail from "@/components/SocJobDetail";
import { prisma } from "@/lib/prisma";
import { authorizeSocJob } from "@/lib/soc";

export const dynamic = "force-dynamic";

export default async function SocJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { await authorizeSocJob(id); } catch { notFound(); }
  const job = await prisma.socJob.findUnique({ where: { id }, include: { owner: { select: { displayName: true } }, documents: { orderBy: { createdAt: "asc" } }, results: { orderBy: { rowNumber: "asc" } } } });
  if (!job) notFound();
  return <SocJobDetail job={{ id: job.id, title: job.title, status: job.status, stage: job.stage, progress: job.progress, errorMessage: job.errorMessage, ownerName: job.owner.displayName, documents: job.documents.map((d) => ({ id: d.id, type: d.type, name: d.originalName })), results: job.results.map((r) => ({ id: r.id, rowNumber: r.rowNumber, item: r.item, rowType: r.rowType, socText: r.socText, referenceText: r.referenceText, referencePages: Array.isArray(r.referencePages) ? r.referencePages.filter((v): v is number => typeof v === "number") : [], evidenceDocumentId: r.evidenceDocumentId, aiReferenceCheck: r.aiReferenceCheck, aiHeadingTitleCheck: r.aiHeadingTitleCheck, aiDetail: r.aiDetail, aiConfidence: r.aiConfidence, finalReferenceCheck: r.finalReferenceCheck, finalHeadingTitleCheck: r.finalHeadingTitleCheck, finalDetail: r.finalDetail, reviewed: Boolean(r.reviewedAt) })) }} />;
}
