import { PrismaClient } from '.prisma/client'

// NOTE: we import the generated client entry directly (`.prisma/client` →
// index.js) instead of the `@prisma/client` re-export shim. The generated
// index.js exports PrismaClient via a statically analyzable CommonJS export,
// which keeps Turbopack's ESM interop happy in dev.
//
// The cache key below is versioned: bump it after `prisma generate` with
// schema changes so hot-reload creates a fresh client instead of reusing the
// stale singleton kept on globalThis.
const PRISMA_CACHE_KEY = 'prisma:v7'

const globalForPrisma = globalThis as unknown as {
  [key: string]: PrismaClient | undefined
}

export const db =
  globalForPrisma[PRISMA_CACHE_KEY] ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma[PRISMA_CACHE_KEY] = db
