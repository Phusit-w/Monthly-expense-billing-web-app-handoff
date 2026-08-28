ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'USER';

CREATE TABLE "SocJob" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "stage" TEXT NOT NULL DEFAULT 'รอเริ่มงาน',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "confirmedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocDocument" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "pageCount" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocCheckResult" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "item" TEXT NOT NULL,
  "rowType" TEXT NOT NULL,
  "socText" TEXT NOT NULL,
  "referenceText" TEXT NOT NULL,
  "referencePages" JSONB NOT NULL,
  "evidenceDocumentId" TEXT,
  "aiReferenceCheck" TEXT NOT NULL,
  "aiHeadingTitleCheck" TEXT NOT NULL,
  "aiProductIdentity" TEXT NOT NULL,
  "aiContentRelevance" TEXT NOT NULL,
  "aiDetail" TEXT NOT NULL,
  "aiConfidence" TEXT NOT NULL,
  "finalReferenceCheck" TEXT NOT NULL,
  "finalHeadingTitleCheck" TEXT NOT NULL,
  "finalProductIdentity" TEXT NOT NULL,
  "finalContentRelevance" TEXT NOT NULL,
  "finalDetail" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocCheckResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocAuditEvent" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "detail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocDocument_storageKey_key" ON "SocDocument"("storageKey");
CREATE INDEX "SocJob_ownerId_updatedAt_idx" ON "SocJob"("ownerId", "updatedAt");
CREATE INDEX "SocJob_status_createdAt_idx" ON "SocJob"("status", "createdAt");
CREATE INDEX "SocJob_expiresAt_idx" ON "SocJob"("expiresAt");
CREATE INDEX "SocDocument_jobId_type_idx" ON "SocDocument"("jobId", "type");
CREATE UNIQUE INDEX "SocCheckResult_jobId_rowNumber_key" ON "SocCheckResult"("jobId", "rowNumber");
CREATE INDEX "SocCheckResult_jobId_finalReferenceCheck_idx" ON "SocCheckResult"("jobId", "finalReferenceCheck");
CREATE INDEX "SocAuditEvent_jobId_createdAt_idx" ON "SocAuditEvent"("jobId", "createdAt");

ALTER TABLE "SocJob" ADD CONSTRAINT "SocJob_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocDocument" ADD CONSTRAINT "SocDocument_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SocJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocCheckResult" ADD CONSTRAINT "SocCheckResult_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SocJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocAuditEvent" ADD CONSTRAINT "SocAuditEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SocJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocAuditEvent" ADD CONSTRAINT "SocAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
