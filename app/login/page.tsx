import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

// Reachable without a session (proxy.ts special-cases this exact
// pathname) — everything else redirects here first. `next` carries where
// to send the user back to after a successful login (set by proxy.ts's
// redirect).
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Only ever follow a same-site path — an absolute/external `next` would
  // make this an open redirect.
  const safeNext = next && next.startsWith("/") ? next : "/";
  return <LoginForm next={safeNext} />;
}
