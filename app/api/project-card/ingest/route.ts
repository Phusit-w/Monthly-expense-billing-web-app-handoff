import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MAX_PROJECTS_PER_REQUEST, requireIngestKey, validateProjectCardInput } from "@/lib/project-card";
import type { ProjectCardInput } from "@/lib/project-card";

export const runtime = "nodejs";

// Pushed by the extraction script that crawls the `PS` share from a machine
// that has access to it — this app's server doesn't (see
// docs/adr/0005-project-card-push-based-ingest.md). One request represents
// the crawler's full current view of the share: every still-present project
// is re-sent every run, so a card the crawler stops sending simply stops
// getting refreshed rather than being deleted (no explicit removal in v1).
export async function POST(request: Request) {
  try {
    requireIngestKey(request);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const projects = (body as { projects?: unknown } | null)?.projects;
  if (!Array.isArray(projects) || projects.length === 0) {
    return NextResponse.json({ error: '"projects" must be a non-empty array' }, { status: 400 });
  }
  if (projects.length > MAX_PROJECTS_PER_REQUEST) {
    return NextResponse.json({ error: `"projects" exceeds the ${MAX_PROJECTS_PER_REQUEST}-record limit per request` }, { status: 400 });
  }

  const validated: ProjectCardInput[] = [];
  const errors: { folderPath?: string; message: string }[] = [];
  for (const raw of projects) {
    try {
      validated.push(validateProjectCardInput(raw));
    } catch (error) {
      const folderPath = typeof (raw as { folderPath?: unknown })?.folderPath === "string" ? ((raw as { folderPath: string }).folderPath) : undefined;
      errors.push({ folderPath, message: error instanceof Error ? error.message : "Invalid record" });
    }
  }

  let created = 0;
  let updated = 0;
  // Never overwrites a human-confirmed budget with a fresh AI guess — see
  // CONTEXT.md's Budget entry ("never shown as authoritative before [a
  // person confirms it]"). Re-crawls still refresh the rest of the card.
  let skippedVerifiedBudget = 0;

  await prisma.$transaction(async (tx) => {
    for (const project of validated) {
      const existing = await tx.projectCard.findUnique({ where: { folderPath: project.folderPath } });
      if (!existing) {
        await tx.projectCard.create({
          data: {
            folderPath: project.folderPath,
            client: project.client,
            projectName: project.projectName,
            descriptionTh: project.descriptionTh,
            descriptionEn: project.descriptionEn,
            budgetAmount: project.budgetAmount,
            year: project.year,
          },
        });
        created++;
        continue;
      }

      if (existing.budgetVerified) skippedVerifiedBudget++;
      await tx.projectCard.update({
        where: { folderPath: project.folderPath },
        data: {
          client: project.client,
          projectName: project.projectName,
          descriptionTh: project.descriptionTh,
          descriptionEn: project.descriptionEn,
          year: project.year,
          ...(existing.budgetVerified ? {} : { budgetAmount: project.budgetAmount }),
        },
      });
      updated++;
    }
  });

  return NextResponse.json({ created, updated, skippedVerifiedBudget, rejected: errors.length, errors });
}
