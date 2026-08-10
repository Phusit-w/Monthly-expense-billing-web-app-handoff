"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { EmployeeSnapshot, SavedEmployeeEntry } from "@/lib/types";

// There's no login in this app (see plan), so there is exactly one shared
// profile row that acts as the org-wide default for new bills. It always
// lives at this fixed id.
const PROFILE_ID = "singleton";

export async function getProfile(): Promise<EmployeeSnapshot> {
  const row = await prisma.employeeProfile.upsert({
    where: { id: PROFILE_ID },
    update: {},
    create: { id: PROFILE_ID },
  });
  return {
    name: row.name,
    position: row.position,
    department: row.department,
    office: row.office,
    employeeNo: row.employeeNo,
  };
}

export async function updateProfile(
  patch: Partial<EmployeeSnapshot>
): Promise<EmployeeSnapshot> {
  const row = await prisma.employeeProfile.upsert({
    where: { id: PROFILE_ID },
    update: patch,
    create: { id: PROFILE_ID, ...patch },
  });
  revalidatePath("/");
  return {
    name: row.name,
    position: row.position,
    department: row.department,
    office: row.office,
    employeeNo: row.employeeNo,
  };
}

// Distinct from the single EmployeeProfile default above: several different
// people share this same login-less app, so each can save their own details
// once under their own name ("บันทึกไว้ใช้ซ้ำ" — EntryEmployeeFields) and pick
// themselves back out of the saved-name list next time, rather than
// retyping every time or overwriting the one shared default. name is the
// lookup key — saving again under the same name updates that entry in
// place instead of creating a duplicate.
export async function listSavedEmployees(): Promise<SavedEmployeeEntry[]> {
  const rows = await prisma.savedEmployee.findMany({ orderBy: { name: "asc" } });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    position: row.position,
    department: row.department,
    office: row.office,
    employeeNo: row.employeeNo,
  }));
}

// Returns the saved row (with its id) rather than void — callers keep a
// local optimistic copy of the saved-employees list and need the id to let
// a just-saved entry be deleted again without a page reload. Returns null
// when there's nothing to save (blank name), same no-op as before.
export async function saveEmployeeForReuse(
  employee: EmployeeSnapshot
): Promise<SavedEmployeeEntry | null> {
  const name = employee.name.trim();
  if (!name) return null; // no name typed yet — nothing to key the saved entry by
  const row = await prisma.savedEmployee.upsert({
    where: { name },
    update: {
      position: employee.position,
      department: employee.department,
      office: employee.office,
      employeeNo: employee.employeeNo,
    },
    create: { ...employee, name },
  });
  // Both entry-form routes are already force-dynamic (fetch fresh on every
  // request), so no revalidatePath is needed here the way updateProfile
  // above needs one for the (statically-cacheable-by-default) "/" route.
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    department: row.department,
    office: row.office,
    employeeNo: row.employeeNo,
  };
}

export async function deleteSavedEmployee(id: string): Promise<void> {
  await prisma.savedEmployee.delete({ where: { id } });
}
