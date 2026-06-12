// Runs before each test file's imports: point lib/db at the test database
// and remove the artificial processing latency.
process.env.DATABASE_URL = 'file:./prisma/test.db';
process.env.PROCESSING_DELAY_MS = '0';
