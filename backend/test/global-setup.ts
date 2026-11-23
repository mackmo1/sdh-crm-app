import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Brings the test database up to the current schema before the suite runs.
 * The test database is a disposable local database; production is never a
 * target here because the URL comes from CRM_TEST_DATABASE_URL.
 */
export async function setup(): Promise<void> {
  const databaseUrl =
    process.env.CRM_TEST_DATABASE_URL ??
    'postgresql://crm:crm_dev_password@127.0.0.1:5432/crm_test';

  execSync('npx prisma migrate deploy', {
    cwd: projectRoot,
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
