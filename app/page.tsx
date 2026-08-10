import { getProfile, listSavedEmployees } from "@/actions/profile";
import { listRecords } from "@/actions/records";
import Header from "@/components/Header";
import PageShell from "@/components/PageShell";
import ProfileCard from "@/components/ProfileCard";
import RecordsTable from "@/components/RecordsTable";

// Records change whenever anyone saves/deletes a bill, so this page must
// never be served from a static build-time snapshot.
export const dynamic = "force-dynamic";

// The history view — ported from the `isHistory` sc-if block in the design
// source. Server Component: fetches profile + records straight from the DB.
export default async function HistoryPage() {
  // Sequential, not Promise.all: verified against this project's Postgres
  // setup that concurrent queries sharing one Prisma client can corrupt the
  // wire protocol (mixed-up bind/prepared-statement state). Three
  // lightweight queries in series costs nothing noticeable here.
  const profile = await getProfile();
  const savedEmployees = await listSavedEmployees();
  const records = await listRecords();

  return (
    <PageShell>
      <Header />
      <ProfileCard initialProfile={profile} savedEmployees={savedEmployees} />
      <RecordsTable records={records} />
    </PageShell>
  );
}
