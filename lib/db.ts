import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@/generated/prisma/client';

// DATABASE_URL is only set by tests (to point at a throwaway file); the app
// itself always uses prisma/dev.db relative to the project root.
const databaseUrl = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';

function createClient() {
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: databaseUrl }),
  });
}

// Reuse one client across Next.js hot reloads in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
