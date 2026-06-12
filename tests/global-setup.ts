import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');

// Build a fresh throwaway SQLite database for the test run.
export default function setup() {
  rmSync(path.join(root, 'prisma', 'test.db'), { force: true });
  execSync('npx prisma db push --accept-data-loss --url "file:./prisma/test.db"', {
    cwd: root,
    stdio: 'inherit',
  });
}
