import { defineConfig } from 'vitest/config';

const TEST_DATABASE_URL =
  process.env.CRM_TEST_DATABASE_URL ??
  'postgresql://crm:crm_dev_password@127.0.0.1:5432/crm_test';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      EMAIL_TRANSPORT: 'console',
      SESSION_TTL_HOURS: '168',
      COOKIE_SECURE: 'false',
      WEB_ORIGIN: 'http://localhost:5173',
      NODE_ENV: 'test',
    },
  },
});
