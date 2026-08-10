"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { fa017Totals, fa018Total } from "@/lib/totals";
import type {
  Draft,
  DraftItem,
  ExpenseRecordData,
  FA017Item,
  FA018Item,
} from "@/lib/types";

type PrismaExpenseRecord = Awaited<
  ReturnType<typeof prisma.expenseRecord.findFirstOrThrow>
>;

function serialize(row: PrismaExpenseRecord): ExpenseRecordData {
  return {
    id: row.id,
    type: row.type as ExpenseRecordData["type"],
    day: row.day,
    monthName: row.monthName,
    monthYear: row.monthYear,
    employeeName: row.employeeName,
    employeePosition: row.employeePosition,
    employeeDepartment: row.employeeDepartment,
    employeeOffice: row.employeeOffice,
    employeeNo: row.employeeNo,
    remark: row.remark,
    items: row.items as unknown as DraftItem[],
    total: row.total.toString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function computeTotal(draft: Draft): number {
  return draft.type === "FA018"
    ? fa018Total(draft.items as FA018Item[])
    : fa017Totals(draft.items as FA017Item[]).thb;
}

export async function listRecords(): Promise<ExpenseRecordData[]> {
  const rows = await prisma.expenseRecord.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(serialize);
}

export async function getRecord(
  id: string
): Promise<ExpenseRecordData | null> {
  const row = await prisma.expenseRecord.findUnique({ where: { id } });
  return row ? serialize(row) : null;
}

// Mirrors Component.saveDraft: creates a new record, or updates in place
// when the draft carries an existing id.
export async function saveRecord(draft: Draft): Promise<ExpenseRecordData> {
  const total = computeTotal(draft);
  const data = {
    type: draft.type,
    day: draft.day,
    monthName: draft.monthName,
    monthYear: draft.monthYear,
    employeeName: draft.employee.name,
    employeePosition: draft.employee.position,
    employeeDepartment: draft.employee.department,
    employeeOffice: draft.employee.office,
    employeeNo: draft.employee.employeeNo,
    remark: draft.remark,
    items: draft.items as object[],
    total,
  };

  const row = draft.id
    ? await prisma.expenseRecord.update({ where: { id: draft.id }, data })
    : await prisma.expenseRecord.create({ data });

  revalidatePath("/");
  return serialize(row);
}

export async function deleteRecord(id: string): Promise<void> {
  await prisma.expenseRecord.delete({ where: { id } });
  revalidatePath("/");
}

// Mirrors Component.duplicateRecord: clone with a fresh id/timestamps,
// prepended to the list (achieved here via a new row + updatedAt: now).
export async function duplicateRecord(id: string): Promise<ExpenseRecordData> {
  const source = await prisma.expenseRecord.findUniqueOrThrow({
    where: { id },
  });
  const row = await prisma.expenseRecord.create({
    data: {
      type: source.type,
      day: source.day,
      monthName: source.monthName,
      monthYear: source.monthYear,
      employeeName: source.employeeName,
      employeePosition: source.employeePosition,
      employeeDepartment: source.employeeDepartment,
      employeeOffice: source.employeeOffice,
      employeeNo: source.employeeNo,
      remark: source.remark,
      items: source.items as object[],
      total: source.total,
    },
  });
  revalidatePath("/");
  return serialize(row);
}
