ALTER TABLE "SocCheckResult"
ADD COLUMN "keywordMatch" TEXT,
ADD COLUMN "ruleVerdict" TEXT,
ADD COLUMN "aiVerdict" TEXT,
ADD COLUMN "semanticEvidence" JSONB,
ADD COLUMN "verdictReason" TEXT,
ADD COLUMN "semanticEngineVersion" TEXT,
ADD COLUMN "benchmarkVersion" TEXT;
