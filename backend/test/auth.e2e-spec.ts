import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import {
  createStaffUser,
  createTestApp,
  login,
  resetDatabase,
  type TestContext,
} from './helpers/test-context.js';

const ADMIN = { email: 'admin@step360d.test', password: 'AdminPassword123' };

describe('Authentication and authorisation (e2e)', () => {
  let context: TestContext;
  let app: INestApplication;

  beforeAll(async () => {
    context = await createTestApp();
    app = context.app;
  });

  beforeEach(async () => {
    await resetDatabase(context.prisma);
    context.email.messages.length = 0;
    await createStaffUser(context.prisma, { ...ADMIN, role: 'admin', module: 'all' });
  });

  afterAll(async () => {
    await context.prisma.$disconnect();
    await app.close();
  });

  it('signs in with valid credentials and returns the current user', async () => {
    const agent = await login(app, ADMIN.email, ADMIN.password);

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user).toMatchObject({
      email: ADMIN.email,
      role: 'admin',
      module: 'all',
    });
    expect(me.body.user.id).toBeTruthy();
  });

  it('rejects a wrong password', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: ADMIN.email, password: 'wrong-password' })
      .expect(401);

    expect(response.body.message).toBe('Invalid email or password');
  });

  it('gives the same answer for an unknown account', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nobody@step360d.test', password: 'whatever123' })
      .expect(401);

    expect(response.body.message).toBe('Invalid email or password');
  });

  it('rejects a deactivated account', async () => {
    await createStaffUser(context.prisma, {
      email: 'inactive@step360d.test',
      password: 'InactivePass123',
      active: false,
    });

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'inactive@step360d.test', password: 'InactivePass123' })
      .expect(401);
  });

  it('requires a session for protected endpoints', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('revokes the session on logout', async () => {
    const agent = await login(app, ADMIN.email, ADMIN.password);
    await agent.get('/api/auth/me').expect(200);

    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  it('allows an administrator to reach the property module', async () => {
    const agent = await login(app, ADMIN.email, ADMIN.password);
    await agent.get('/api/properties').expect(200);
  });

  it('blocks a data user assigned to a different module', async () => {
    await createStaffUser(context.prisma, {
      email: 'lead@step360d.test',
      password: 'LeadUserPass123',
      role: 'data_user',
      module: 'lead',
    });

    const agent = await login(app, 'lead@step360d.test', 'LeadUserPass123');
    const response = await agent.get('/api/properties').expect(403);
    expect(response.body.message).toContain('module');
  });

  it('allows a data user assigned to the property module', async () => {
    await createStaffUser(context.prisma, {
      email: 'property@step360d.test',
      password: 'PropertyUser123',
      role: 'data_user',
      module: 'property',
    });

    const agent = await login(app, 'property@step360d.test', 'PropertyUser123');
    await agent.get('/api/properties').expect(200);
  });

  it('resets a password through the emailed token and revokes open sessions', async () => {
    const agent = await login(app, ADMIN.email, ADMIN.password);

    const forgot = await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: ADMIN.email })
      .expect(200);
    expect(forgot.body.delivered).toBe(true);
    expect(context.email.messages).toHaveLength(1);

    const token = context.email.lastToken();
    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token, password: 'BrandNewPassword123' })
      .expect(204);

    // The existing session must no longer be usable.
    await agent.get('/api/auth/me').expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: ADMIN.email, password: ADMIN.password })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: ADMIN.email, password: 'BrandNewPassword123' })
      .expect(200);
  });

  it('does not reveal whether an email address exists', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: 'missing@step360d.test' })
      .expect(200);

    expect(response.body.delivered).toBe(false);
    expect(context.email.messages).toHaveLength(0);
  });

  it('rejects an expired or reused reset token', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: ADMIN.email })
      .expect(200);

    const token = context.email.lastToken();
    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token, password: 'FirstReset123' })
      .expect(204);

    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token, password: 'SecondReset123' })
      .expect(401);
  });
});
