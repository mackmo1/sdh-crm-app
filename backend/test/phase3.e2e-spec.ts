import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import {
  createStaffUser,
  createTestApp,
  login,
  resetDatabase,
  type TestContext,
} from './helpers/test-context.js';

const ADMIN = { email: 'admin@step360d.test', password: 'AdminPassword123' };

describe('Projects, imports and exports (e2e)', () => {
  let context: TestContext;
  let app: INestApplication;
  let agent: Awaited<ReturnType<typeof login>>;

  beforeAll(async () => {
    context = await createTestApp();
    app = context.app;
  });

  beforeEach(async () => {
    await resetDatabase(context.prisma);
    await createStaffUser(context.prisma, { ...ADMIN, role: 'admin', module: 'all' });
    agent = await login(app, ADMIN.email, ADMIN.password);
  });

  afterAll(async () => {
    await context.prisma.$disconnect();
    await app.close();
  });

  describe('projects', () => {
    it('creates, updates and archives a project without deleting it', async () => {
      const created = await agent
        .post('/api/projects')
        .send({ name: 'Skyline Heights', city: 'Pune', address: 'Baner' })
        .expect(201);
      expect(created.body.archived).toBe(false);

      const updated = await agent
        .put(`/api/projects/${created.body.id}`)
        .send({ priceRange: '80L – 2.4Cr' })
        .expect(200);
      expect(updated.body.priceRange).toBe('80L – 2.4Cr');

      const archived = await agent.post(`/api/projects/${created.body.id}/archive`).expect(200);
      expect(archived.body.archived).toBe(true);

      // The record is preserved and visible when archived are included.
      const withArchived = await agent.get('/api/projects?includeArchived=true').expect(200);
      expect(withArchived.body.meta.total).toBe(1);

      const defaultList = await agent.get('/api/projects').expect(200);
      expect(defaultList.body.meta.total).toBe(0);

      await agent.put(`/api/projects/${created.body.id}`).send({ city: 'Mumbai' }).expect(409);

      const restored = await agent.post(`/api/projects/${created.body.id}/restore`).expect(200);
      expect(restored.body.archived).toBe(false);
    });

    it('aggregates inventory by configuration and availability', async () => {
      const project = await agent.post('/api/projects').send({ name: 'Green Meadows', city: 'Pune' }).expect(201);

      for (const [unit, rooms] of [['A-101', '2BHK'], ['A-102', '2BHK'], ['A-103', '3BHK']] as const) {
        const property = await agent
          .post('/api/properties')
          .send({ listingType: 'SALE', city: 'Pune', address: unit, rooms, price: 9_000_000, projectId: Number(project.body.id), unitIdentifier: unit })
          .expect(201);
        await agent.post(`/api/properties/${property.body.id}/publish`).expect(200);
      }

      const inventory = await agent.get(`/api/projects/${project.body.id}/inventory`).expect(200);
      expect(inventory.body.summary.unitCount).toBe(3);
      const byConfig = Object.fromEntries(
        inventory.body.summary.byConfiguration.map((row: { configuration: string; count: number }) => [row.configuration, row.count]),
      );
      expect(byConfig['2BHK']).toBe(2);
      expect(byConfig['3BHK']).toBe(1);
    });
  });

  describe('exports', () => {
    it('exports contacts as CSV without sensitive fields', async () => {
      await agent
        .post('/api/contacts')
        .send({ name: 'Anita Desai', category: 'SELLER', phone: '+919820000010' })
        .expect(201);

      const response = await agent.get('/api/data/export/contacts').expect(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.text.split('\r\n')[0]).toContain('name');
      expect(response.text).toContain('Anita Desai');
      expect(response.text.toLowerCase()).not.toContain('password');
      expect(response.text.toLowerCase()).not.toContain('token');
    });
  });

  describe('imports', () => {
    const csv = [
      'name,category,phone,email',
      'Meera Iyer,LANDLORD,+919820000201,meera@example.test',
      'Broken Row,NOT_A_CATEGORY,+919820000202,broken@example.test',
      'Anita Desai,SELLER,+919820000010,anita@example.test',
    ].join('\n');

    it('reports invalid rows and duplicates in the preview', async () => {
      await agent
        .post('/api/contacts')
        .send({ name: 'Anita Desai', category: 'SELLER', phone: '+919820000010' })
        .expect(201);

      const preview = await agent
        .post('/api/data/import/contacts/preview')
        .send({ csv })
        .expect(201);

      expect(preview.body.totalRows).toBe(3);
      expect(preview.body.validRows).toBe(1);
      expect(preview.body.invalidRows).toBe(1);
      expect(preview.body.duplicateRows).toBe(1);
      expect(preview.body.issues).toHaveLength(2);
    });

    it('imports only the valid rows and reports a summary', async () => {
      await agent
        .post('/api/contacts')
        .send({ name: 'Anita Desai', category: 'SELLER', phone: '+919820000010' })
        .expect(201);

      const result = await agent.post('/api/data/import/contacts').send({ csv }).expect(201);
      expect(result.body.imported).toBe(1);
      expect(result.body.skipped).toBe(1);
      expect(result.body.failed).toBe(1);

      const list = await agent.get('/api/contacts').expect(200);
      expect(list.body.meta.total).toBe(2);

      const imported = await context.prisma.contact.findFirst({ where: { name: 'Meera Iyer' } });
      expect(imported).not.toBeNull();
    });

    it('imports leads from CSV', async () => {
      const leadCsv = [
        'name,phone,email,location',
        'Nilesh Gupta,+919820000301,nilesh@example.test,Thane',
      ].join('\n');

      const result = await agent.post('/api/data/import/leads').send({ csv: leadCsv }).expect(201);
      expect(result.body.imported).toBe(1);

      const leads = await agent.get('/api/leads').expect(200);
      expect(leads.body.meta.total).toBe(1);
    });
  });

  describe('change history', () => {
    it('records staff changes', async () => {
      const created = await agent
        .post('/api/staff')
        .send({ name: 'Audit User', email: 'audit@step360d.test', role: 'data_user', module: 'lead', password: 'Password123' })
        .expect(201);

      await agent.put(`/api/staff/${created.body.id}`).send({ module: 'all' }).expect(200);

      const entries = await context.prisma.changeHistory.findMany({
        where: { entity_type: 'staff', entity_id: created.body.id },
      });
      expect(entries.length).toBeGreaterThanOrEqual(2);
    });
  });
});
