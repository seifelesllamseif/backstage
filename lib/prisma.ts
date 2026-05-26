import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Server-only. Never import from a client component. Prisma 7's client
// needs a driver adapter — see docs/decisions/0007-prisma-7-adapter-pattern.md.
//
// URL split (decision 0007, revised): runtime reads APP_DATABASE_URL
// (Supabase Transaction pooler, port 6543) so dashboard fan-out fetches
// don't exhaust the Session pooler's 15-client cap. DATABASE_URL stays
// on the Session pooler for `prisma migrate` (needs advisory locks).
// Falls back to DATABASE_URL so existing setups keep working.

function createClient() {
  const url = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "APP_DATABASE_URL (or DATABASE_URL) is not set. Copy .env.example to .env.local and fill it in.",
    );
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url, max: 10 }),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
