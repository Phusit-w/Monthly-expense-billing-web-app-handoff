import { prisma } from "@/lib/prisma";
import { requireActor } from "@/lib/authorization";
import Field from "@/components/ui/Field";
import { SearchIcon } from "@/components/icons";
import ProjectCardBudgetForm from "@/components/ProjectCardBudgetForm";
import CopyButton from "@/components/CopyButton";

export const dynamic = "force-dynamic";

// A v1 catalog cap, not real pagination — see CONTEXT.md, there's no
// pagination decision on record yet and this app has no other paginated
// list either. Revisit once a real crawl's card count approaches this.
const RESULT_LIMIT = 200;

// Flat access (docs/adr/0006-project-card-flat-access-control.md): any
// signed-in user, no extra role check — same as every other screen in this
// app.
export default async function ProjectCardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireActor();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const cards = await prisma.projectCard.findMany({
    where: query
      ? {
          OR: [
            { client: { contains: query, mode: "insensitive" } },
            { projectName: { contains: query, mode: "insensitive" } },
            { descriptionTh: { contains: query, mode: "insensitive" } },
            { descriptionEn: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { updatedAt: "desc" },
    take: RESULT_LIMIT,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[28px] font-bold">ค้นหาโครงการ</h1>
        <p className="mt-1 text-sm text-muted">
          ค้นหาจากลูกค้า ชื่อโครงการ หรือคำอธิบาย — ข้อมูลมาจากการ crawl share{" "}
          <code className="text-xs">PS</code> ด้วยมือ (ดู{" "}
          <code className="text-xs">project-card-crawler/README.md</code>)
        </p>
      </div>

      <form method="get" className="max-w-md">
        <Field
          label="ค้นหา"
          name="q"
          defaultValue={query}
          leftIcon={<SearchIcon size={18} />}
          placeholder="เช่น Solarcell, RFID, MEA"
        />
      </form>

      <div className="overflow-hidden rounded-card bg-surface shadow-card">
        {cards.length ? (
          <ul className="divide-y divide-line">
            {cards.map((card) => (
              <li key={card.id} className="flex flex-col gap-3 px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-chip px-3 py-1 text-xs font-medium text-label">
                        {card.client}
                      </span>
                      {card.year ? <span className="text-xs text-muted">ปี {card.year}</span> : null}
                    </div>
                    <div className="mt-1 font-display text-lg font-semibold text-ink">{card.projectName}</div>
                  </div>
                  <ProjectCardBudgetForm
                    id={card.id}
                    budgetAmount={card.budgetAmount ? card.budgetAmount.toString() : null}
                    budgetVerified={card.budgetVerified}
                  />
                </div>

                {card.descriptionTh || card.descriptionEn ? (
                  <div className="text-sm text-label">
                    {card.descriptionTh ? <p>{card.descriptionTh}</p> : null}
                    {card.descriptionEn ? <p className="text-muted">{card.descriptionEn}</p> : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted">ยังไม่มีคำอธิบาย (รอ AI สรุป หรือกรอกเอง)</p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <code className="flex-1 truncate rounded-input bg-chip px-3 py-2 text-xs text-muted">
                    {card.folderPath}
                  </code>
                  <CopyButton value={card.folderPath} label="คัดลอกพาธ" />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-12 text-center">
            <div className="font-display text-lg font-semibold">
              {query ? "ไม่พบโครงการที่ค้นหา" : "ยังไม่มีข้อมูลโครงการ"}
            </div>
            <p className="mt-2 text-sm text-muted">
              {query ? "ลองคำค้นอื่น" : "รันสคริปต์ crawler เพื่อดึงข้อมูลจาก share ก่อน"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
