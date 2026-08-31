import Link from "next/link";
import { prisma } from "@/lib/prisma";

// Per-request "24 hours ago". Kept in a plain helper rather than inline in
// the component body so the react-hooks purity rule doesn't flag the
// Date.now()/new Date() call as an impure function called during render.
function since24h(): Date {
  return new Date(Date.now() - 86_400_000);
}

export default async function AdminPage() {
  const [users, expenses, soc, trash, audits] = await Promise.all([
    prisma.user.count(),
    prisma.expenseRecord.count({ where: { deletedAt: null } }),
    prisma.socJob.count({ where: { deletedAt: null } }),
    prisma.expenseRecord
      .count({ where: { deletedAt: { not: null } } })
      .then(async (n) => n + (await prisma.socJob.count({ where: { deletedAt: { not: null } } }))),
    prisma.auditLog.count({ where: { createdAt: { gte: since24h() } } }),
  ]);

  const cards: [string, number, string][] = [
    ["ผู้ใช้", users, "/admin/users"],
    ["เอกสารค่าใช้จ่าย", expenses, "/records"],
    ["งาน SOC", soc, "/soc"],
    ["ถังขยะ", trash, "/admin/trash"],
    ["กิจกรรม 24 ชม.", audits, "/admin/activity"],
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {cards.map(([label, value, href]) => (
        <Link href={href} key={label} className="rounded-card border border-line bg-surface p-5 shadow-card">
          <div className="text-sm text-muted">{label}</div>
          <div className="mt-2 font-display text-3xl font-bold">{value}</div>
        </Link>
      ))}
    </div>
  );
}
