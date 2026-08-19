import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7's client is engine-less: it needs an explicit driver adapter
// rather than reading DATABASE_URL implicitly. See lib/generated/prisma/client.ts.
//
// max: 1 pins the whole app to a single physical connection rather than
// pg's default pool of up to 10. Several pages already work around a
// concrete symptom of this — see app/page.tsx's/app/bill/entry/[type]/
// page.tsx's "sequential, not Promise.all" comments — but those only cover
// queries issued *within one request*; two separate requests (e.g. this
// page's own load racing a Next.js Link-hover prefetch of another route)
// can still each grab their own pooled connection and run concurrently
// against it, hitting the same "bind message supplies N parameters, but
// prepared statement "" requires 0" Postgres protocol error (08P01) —
// mismatched bind/prepared-statement state between two connections'
// interleaved extended-protocol messages. Capping the pool to one
// connection serializes every query app-wide (pg just queues the rest),
// closing that gap regardless of which two requests happen to overlap.
// Fine for this app's actual load (single shared-password intranet tool,
// not many concurrent users) — see docs/DEPLOY.md.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 1 });

// Reuse a single PrismaClient across hot reloads in dev so we don't exhaust
// Postgres connections; in production each server instance gets one client.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
