import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// This app has no per-user login by design (see actions/profile.ts's
// comment: it's a single shared intranet tool, not a multi-user system) —
// instead, one shared username/password pair (AUTH_USERNAME / AUTH_PASSWORD,
// set in .env) gates every route via plain HTTP Basic Auth. This is meant
// to run behind HTTPS (see docker-compose.yml's caddy service): Basic Auth
// sends credentials as unencrypted base64, so without TLS in front of this,
// the password is exposed to anyone who can see the network traffic.
//
// Named/filed as `proxy.ts` (not `middleware.ts`) — this Next.js version
// (16) renamed the convention; see node_modules/next/dist/docs/01-app/
// 03-api-reference/03-file-conventions/proxy.md. The exported function
// must be named `proxy`, not `middleware`.
const REALM = "expense-billing-app";

// Per-IP rate limit — a plain sliding-ish window counter kept in memory.
// Checked BEFORE the auth check below so it also throttles someone
// script-guessing the shared Basic Auth password, not just authenticated
// abuse. In-memory state is fine for this app's deployment shape (exactly
// one `app` replica — see docker-compose.yml, there's no load balancer
// splitting traffic across multiple instances to keep this in sync with);
// it would need moving to something shared (e.g. Redis) if that ever
// changed. The map is never proactively pruned — for an intranet tool the
// number of distinct client IPs ever seen is small and bounded, so the
// worst case is a few dozen stale entries sitting in memory, not a real
// leak.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 120;
const requestCounts = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = requestCounts.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    requestCounts.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

function clientIp(request: NextRequest): string {
  // Caddy (docker-compose.yml) sets X-Forwarded-For on every request it
  // proxies; the first entry is the original client. Falls back to a
  // constant key if it's ever missing (e.g. hit directly, bypassing
  // Caddy) — still rate-limits, just as one shared bucket instead of
  // per-IP in that case, rather than not rate-limiting at all.
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

export function proxy(request: NextRequest) {
  // Local development: skip the prompt entirely rather than forcing every
  // `npm run dev` session to configure credentials just to load the page.
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  if (isRateLimited(clientIp(request))) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(RATE_LIMIT_WINDOW_MS / 1000) },
    });
  }

  const username = process.env.AUTH_USERNAME;
  const password = process.env.AUTH_PASSWORD;

  if (!username || !password) {
    // Misconfigured production deploy — fail loud and closed (refuse every
    // request with a clear message) rather than silently letting the app
    // run wide open because someone forgot to set these two variables.
    return new NextResponse(
      "Server misconfigured: AUTH_USERNAME / AUTH_PASSWORD are not set. Refusing all requests until they are configured — see DEPLOY.md.",
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const decoded = atob(authHeader.slice("Basic ".length));
    const sep = decoded.indexOf(":");
    const user = sep === -1 ? decoded : decoded.slice(0, sep);
    const pass = sep === -1 ? "" : decoded.slice(sep + 1);
    if (user === username && pass === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"` },
  });
}

export const config = {
  matcher: [
    // Everything except Next's own static-asset routes — those carry no
    // real data, and skipping them avoids an extra 401 round-trip per
    // JS/CSS chunk before the browser's cached credential kicks in.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
