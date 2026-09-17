-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ProjectCard" (
    "id" TEXT NOT NULL,
    "folderPath" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "descriptionTh" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "budgetAmount" DECIMAL(15,2),
    "budgetVerified" BOOLEAN NOT NULL DEFAULT false,
    "budgetVerifiedAt" TIMESTAMP(3),
    "budgetVerifiedById" TEXT,
    "year" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCard_folderPath_key" ON "ProjectCard"("folderPath");

-- CreateIndex
CREATE INDEX "ProjectCard_client_idx" ON "ProjectCard"("client");

-- AddForeignKey
ALTER TABLE "ProjectCard" ADD CONSTRAINT "ProjectCard_budgetVerifiedById_fkey" FOREIGN KEY ("budgetVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
