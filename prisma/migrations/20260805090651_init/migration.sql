-- CreateTable
CREATE TABLE "EmployeeProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "position" TEXT NOT NULL DEFAULT '',
    "department" TEXT NOT NULL DEFAULT '',
    "office" TEXT NOT NULL DEFAULT '',
    "employeeNo" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseRecord" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "monthName" TEXT NOT NULL,
    "monthYear" INTEGER NOT NULL,
    "employeeName" TEXT NOT NULL DEFAULT '',
    "employeePosition" TEXT NOT NULL DEFAULT '',
    "employeeDepartment" TEXT NOT NULL DEFAULT '',
    "employeeOffice" TEXT NOT NULL DEFAULT '',
    "employeeNo" TEXT NOT NULL DEFAULT '',
    "remark" TEXT NOT NULL DEFAULT '',
    "items" JSONB NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpenseRecord_updatedAt_idx" ON "ExpenseRecord"("updatedAt");
