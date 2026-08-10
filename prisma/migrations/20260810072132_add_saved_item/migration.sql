-- CreateTable
CREATE TABLE "SavedItem" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedItem_type_idx" ON "SavedItem"("type");

-- CreateIndex
CREATE UNIQUE INDEX "SavedItem_type_desc_key" ON "SavedItem"("type", "desc");
