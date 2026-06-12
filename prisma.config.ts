import { defineConfig } from 'prisma/config';

// SQLite file path is relative to the project root (where the CLI runs).
// DATABASE_URL is only used to point tests at a separate database file;
// there are no secrets involved.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
  },
});
