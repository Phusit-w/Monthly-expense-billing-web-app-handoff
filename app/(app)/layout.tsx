import { getCurrentUser } from "@/lib/session";
import AppSidebar from "@/components/AppSidebar";
import AppTopBar from "@/components/AppTopBar";

// Shared shell for every signed-in screen (2026 redesign). `/login` is
// deliberately outside this route group so it renders bare. A future
// Applications launcher (`/apps`) slots straight in here.
//
// Reading the session cookie here opts the segment into dynamic rendering,
// which every page under it already required anyway (all set
// `export const dynamic = "force-dynamic"`). Replaces the per-page
// `getCurrentUserInfo()` fetch-on-mount that Header.tsx used to do from four
// disconnected client components.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="app-shell-root min-h-screen bg-ground font-sans text-ink">
      <AppSidebar />
      {/* pl-32 = 128px = 24 (rail inset) + 80 (collapsed rail) + 24 (gap).
          The rail expands over this padding, never widening it. */}
      <div className="app-main flex min-h-screen flex-col gap-6 py-7 pl-32 pr-8 pb-10">
        <AppTopBar displayName={user?.displayName ?? null} />
        <main className="flex min-w-0 flex-1 flex-col gap-6">{children}</main>
      </div>
    </div>
  );
}
