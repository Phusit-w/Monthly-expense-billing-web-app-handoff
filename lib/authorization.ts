import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function requireActor() {
  const actor = await getCurrentUser();
  if (!actor) throw new Error("UNAUTHORIZED");
  return actor;
}

export async function requireRole(role: "ADMIN") {
  const actor = await requireActor();
  if (actor.role !== role) throw new Error("FORBIDDEN");
  return actor;
}

export async function authorizeExpenseRecord(recordId: string) {
  const actor = await requireActor();
  const record = await prisma.expenseRecord.findUnique({ where: { id: recordId } });
  if (!record || record.deletedAt || (actor.role !== "ADMIN" && record.ownerId !== actor.id)) throw new Error("NOT_FOUND");
  return { actor, record };
}

export async function writeAudit(input: {
  actorId?: string | null;
  targetUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  before?: object | null;
  after?: object | null;
  metadata?: object | null;
}) {
  return prisma.auditLog.create({
    data: {
      actorId: input.actorId || null,
      targetUserId: input.targetUserId || null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId || null,
      summary: input.summary.slice(0, 500),
      before: input.before || undefined,
      after: input.after || undefined,
      metadata: input.metadata || undefined,
    },
  });
}
