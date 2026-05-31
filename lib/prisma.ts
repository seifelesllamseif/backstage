import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

function createClient() {
  // Runtime uses the transaction pooler (APP_DATABASE_URL, port 6543). The
  // session pooler URL (DATABASE_URL, 5432) is kept only as a fallback so
  // `prisma migrate`'s advisory locks still work. Decision 0007.
  const url = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'APP_DATABASE_URL (or DATABASE_URL) is not set. Copy .env.example to .env.local and fill it in.'
    )
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url, max: 10 }),
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error']
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient()
  }
  return globalForPrisma.prisma
}

// Lazy proxy: the env-var check (and PrismaClient instantiation) happens on
// first property access, not at module load. Routes that never touch the DB
// keep working even when APP_DATABASE_URL is unset. Matters during the
// Supabase JS migration where most routes shouldn't need Prisma at all.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient()
    const value = Reflect.get(client, prop)
    return typeof value === 'function' ? value.bind(client) : value
  }
})
