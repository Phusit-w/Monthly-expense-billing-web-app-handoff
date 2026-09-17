"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireActor } from "@/lib/authorization";

// Confirms (and optionally corrects) an AI-extracted budget — see
// app/(app)/project-card/CONTEXT.md's Budget entry. Once verified, a
// re-crawl from project-card-crawler will never overwrite this value again
// (see lib/project-card.ts's ingest upsert). No role check beyond being
// logged in: Project Card follows the app's existing flat access model
// (see docs/adr/0006-project-card-flat-access-control.md) — any signed-in
// user may verify a budget, same as any signed-in user may already see it.
export async function verifyProjectCardBudget(id: string, budgetAmount: number | null): Promise<void> {
  const actor = await requireActor();
  if (budgetAmount !== null && (!Number.isFinite(budgetAmount) || budgetAmount < 0)) {
    throw new Error("จำนวนงบประมาณไม่ถูกต้อง");
  }
  await prisma.projectCard.update({
    where: { id },
    data: {
      budgetAmount,
      budgetVerified: true,
      budgetVerifiedAt: new Date(),
      budgetVerifiedById: actor.id,
    },
  });
  revalidatePath("/project-card");
}
