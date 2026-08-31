import { requireRole } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

function csv(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET() {
  // Map requireRole()'s thrown sentinels to real status codes — an
  // unhandled throw here otherwise surfaces as a bare HTTP 500 (a USER
  // hitting this endpoint got 500 instead of 403).
  try {
    await requireRole("ADMIN");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return new Response("Unauthorized", { status: 401 });
    if (message === "FORBIDDEN") return new Response("Forbidden", { status: 403 });
    throw error;
  }

  const rows = await prisma.auditLog.findMany({
    take: 10000,
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { username: true } } },
  });
  const body = [
    "time,actor,action,entity_type,entity_id,summary",
    ...rows.map((r) =>
      [r.createdAt.toISOString(), r.actor?.username ?? "system", r.action, r.entityType, r.entityId, r.summary]
        .map(csv)
        .join(",")
    ),
  ].join("\r\n");
  // Lead with a UTF-8 BOM so Excel opens the Thai text with the right encoding.
  return new Response("\uFEFF" + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
