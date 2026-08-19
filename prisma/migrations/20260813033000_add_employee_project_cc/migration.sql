-- Project / CC is a stable employee attribute. Existing profiles, saved
-- employees, and records remain valid with an empty default.
ALTER TABLE "EmployeeProfile" ADD COLUMN "projectCC" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SavedEmployee" ADD COLUMN "projectCC" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ExpenseRecord" ADD COLUMN "employeeProjectCC" TEXT NOT NULL DEFAULT '';
