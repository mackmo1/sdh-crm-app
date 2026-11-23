import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp, resetDatabase, type TestContext } from './helpers/test-context.js';

describe('App (e2e)', () => {
  let context: TestContext;
  let app: INestApplication;

  beforeAll(async () => {
    context = await createTestApp();
    app = context.app;
  });

  afterAll(async () => {
    await context.prisma.$disconnect();
    await app.close();
  });

  it('exposes a health endpoint', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(response.body.status).toBe('ok');
  });

  it('rejects unauthenticated access to protected endpoints', async () => {
    await request(app.getHttpServer()).get('/api/properties').expect(401);
  });

  it('resets the database between suites', async () => {
    await resetDatabase(context.prisma);
    expect(await context.prisma.property.count()).toBe(0);
  });
});
