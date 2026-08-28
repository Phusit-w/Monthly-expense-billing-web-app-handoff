ALTER TABLE "User"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "passwordChangedAt" TIMESTAMP(3),
  ADD COLUMN "disabledAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ExpenseRecord"
  ADD COLUMN "ownerId" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedById" TEXT,
  ADD COLUMN "purgeAfter" TIMESTAMP(3),
  ADD COLUMN "restoredAt" TIMESTAMP(3),
  ADD COLUMN "purgedAt" TIMESTAMP(3);

ALTER TABLE "SocJob"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedById" TEXT,
  ADD COLUMN "purgeAfter" TIMESTAMP(3),
  ADD COLUMN "restoredAt" TIMESTAMP(3),
  ADD COLUMN "purgedAt" TIMESTAMP(3);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "targetUserId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "summary" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkerHeartbeat" (
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "currentJobId" TEXT,
  "lastError" TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("name")
);

CREATE INDEX "ExpenseRecord_ownerId_deletedAt_updatedAt_idx" ON "ExpenseRecord"("ownerId", "deletedAt", "updatedAt");
CREATE INDEX "ExpenseRecord_purgeAfter_idx" ON "ExpenseRecord"("purgeAfter");
CREATE INDEX "SocJob_deletedAt_purgeAfter_idx" ON "SocJob"("deletedAt", "purgeAfter");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve old records: assign only when exactly one account has the same
-- displayName. Ambiguous/unmatched rows remain NULL and are Admin-only.
UPDATE "ExpenseRecord" er
SET "ownerId" = (
  SELECT MIN(u.id) FROM "User" u WHERE u."displayName" = er."createdByName"
)
WHERE er."createdByName" <> ''
  AND (SELECT COUNT(*) FROM "User" u WHERE u."displayName" = er."createdByName") = 1;

-- Guarantee a first administrator on installations that predate roles.
UPDATE "User" SET role = 'ADMIN'
WHERE id = (
  SELECT id FROM "User" WHERE "isActive" = true ORDER BY "createdAt" ASC LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM "User" WHERE role = 'ADMIN' AND "isActive" = true);

-- Copy the existing SOC history into the unified append-only log.
INSERT INTO "AuditLog" (id, "actorId", action, "entityType", "entityId", summary, metadata, "createdAt")
SELECT 'legacy_' || id, "actorId", action, 'SOC_JOB', "jobId", action, detail, "createdAt"
FROM "SocAuditEvent";
