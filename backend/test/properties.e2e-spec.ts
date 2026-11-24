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
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Property lifecycle (e2e)', () => {
  let context: TestContext;
  let app: INestApplication;
  let agent: Awaited<ReturnType<typeof login>>;

  const salePayload = () => ({
    listingType: 'SALE',
    city: 'Mumbai',
    address: 'Andheri West',
    rooms: '2BHK',
    price: 25_000_000,
  });

  async function createProperty(overrides: Record<string, unknown> = {}) {
    const response = await agent
      .post('/api/properties')
      .send({ ...salePayload(), ...overrides })
      .expect(201);
    return response.body;
  }

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

  describe('draft creation', () => {
    it('creates a sale draft together with its sale subtype', async () => {
      const property = await createProperty({ ownershipType: 'Freehold', priceNegotiable: true });

      expect(property.listingType).toBe('SALE');
      expect(property.publicationStatus).toBe('DRAFT');
      expect(property.availabilityStatus).toBe('AVAILABLE');
      expect(property.sale).toEqual({ priceNegotiable: true, ownershipType: 'Freehold' });
      expect(property.rent).toBeNull();

      expect(await context.prisma.property.count()).toBe(1);
      expect(await context.prisma.saleProperty.count()).toBe(1);
      expect(await context.prisma.rentProperty.count()).toBe(0);
    });

    it('creates a rent draft together with its rent subtype', async () => {
      const property = await createProperty({
        listingType: 'RENT',
        price: 45_000,
        depositAmount: 90_000,
        furnishing: 'Semi-furnished',
      });

      expect(property.rent).toEqual({
        depositAmount: 90_000,
        maintenanceAmount: null,
        furnishing: 'Semi-furnished',
      });
      expect(property.sale).toBeNull();
      expect(await context.prisma.rentProperty.count()).toBe(1);
      expect(await context.prisma.saleProperty.count()).toBe(0);
    });

    it('allows an incomplete draft to be saved and read back', async () => {
      const property = await createProperty();

      const reloaded = await agent.get(`/api/properties/${property.id}`).expect(200);
      expect(reloaded.body.sale).toEqual({ priceNegotiable: null, ownershipType: null });
      expect(reloaded.body.bathrooms).toBeNull();
      expect(reloaded.body.area).toBeNull();
      expect(reloaded.body.projectId).toBeNull();
    });

    it('rejects rental-only fields on a sale property', async () => {
      const response = await agent
        .post('/api/properties')
        .send({ ...salePayload(), depositAmount: 50_000 })
        .expect(400);

      expect(response.body.message).toContain('rental fields');
      expect(await context.prisma.property.count()).toBe(0);
    });

    it('keeps the legacy listing value the website reads', async () => {
      const sale = await createProperty();
      const rent = await createProperty({ listingType: 'RENT', price: 30_000 });

      const rows = await context.prisma.property.findMany({ orderBy: { id: 'asc' } });
      expect(rows.find((row) => row.id.toString() === sale.id)?.listing).toBe('buy');
      expect(rows.find((row) => row.id.toString() === rent.id)?.listing).toBe('rent');
    });
  });

  describe('publication', () => {
    it('blocks publication while required data is missing', async () => {
      const property = await createProperty({ price: 0 });

      const response = await agent.post(`/api/properties/${property.id}/publish`).expect(400);

      expect(response.body.message).toBe('Property is not ready to publish');
      expect(response.body.missing).toContain('Price');

      const reloaded = await agent.get(`/api/properties/${property.id}`).expect(200);
      expect(reloaded.body.publicationStatus).toBe('DRAFT');
    });

    it('publishes, unpublishes and republishes without duplicating the subtype', async () => {
      const property = await createProperty();

      const published = await agent.post(`/api/properties/${property.id}/publish`).expect(200);
      expect(published.body.publicationStatus).toBe('PUBLISHED');
      expect(published.body.publishedAt).toBeTruthy();

      const unpublished = await agent.post(`/api/properties/${property.id}/unpublish`).expect(200);
      expect(unpublished.body.publicationStatus).toBe('UNPUBLISHED');

      const republished = await agent.post(`/api/properties/${property.id}/publish`).expect(200);
      expect(republished.body.publicationStatus).toBe('PUBLISHED');

      expect(await context.prisma.saleProperty.count({ where: { property_id: BigInt(property.id) } })).toBe(1);
      expect(await context.prisma.saleProperty.count()).toBe(1);
    });

    it('refuses to publish an already published property', async () => {
      const property = await createProperty();
      await agent.post(`/api/properties/${property.id}/publish`).expect(200);

      await agent.post(`/api/properties/${property.id}/publish`).expect(409);
    });

    it('refuses to unpublish a draft', async () => {
      const property = await createProperty();
      await agent.post(`/api/properties/${property.id}/unpublish`).expect(409);
    });

    it('rejects concurrent publication of the same property', async () => {
      const property = await createProperty();

      const [first, second] = await Promise.all([
        agent.post(`/api/properties/${property.id}/publish`),
        agent.post(`/api/properties/${property.id}/publish`),
      ]);

      expect([first.status, second.status].sort((a, b) => a - b)).toEqual([200, 409]);
      expect(await context.prisma.saleProperty.count()).toBe(1);
      expect(await context.prisma.rentProperty.count()).toBe(0);
    });

    it('refuses to publish when both subtypes exist', async () => {
      const property = await createProperty();
      // Bypass the API to simulate corrupted data; publication must notice.
      await context.prisma.rentProperty.create({ data: { property_id: BigInt(property.id) } });

      const response = await agent.post(`/api/properties/${property.id}/publish`).expect(409);
      expect(response.body.message).toContain('both a sale and a rental');
    });
  });

  describe('availability', () => {
    it('allows SOLD on a sale property only', async () => {
      const sale = await createProperty();
      const sold = await agent
        .patch(`/api/properties/${sale.id}/availability`)
        .send({ availabilityStatus: 'SOLD' })
        .expect(200);
      expect(sold.body.availabilityStatus).toBe('SOLD');

      const rejected = await agent
        .patch(`/api/properties/${sale.id}/availability`)
        .send({ availabilityStatus: 'RENTED' })
        .expect(400);
      expect(rejected.body.message).toContain('rental property');
    });

    it('allows RENTED on a rental property only', async () => {
      const rent = await createProperty({ listingType: 'RENT', price: 30_000 });
      await agent
        .patch(`/api/properties/${rent.id}/availability`)
        .send({ availabilityStatus: 'RENTED' })
        .expect(200);

      await agent
        .patch(`/api/properties/${rent.id}/availability`)
        .send({ availabilityStatus: 'SOLD' })
        .expect(400);
    });

    it('blocks availability changes on archived properties', async () => {
      const property = await createProperty();
      await agent
        .post(`/api/properties/${property.id}/archive`)
        .send({ reason: 'Duplicate' })
        .expect(200);

      await agent
        .patch(`/api/properties/${property.id}/availability`)
        .send({ availabilityStatus: 'ON_HOLD' })
        .expect(409);
    });
  });

  describe('archive and restore', () => {
    it('archives without destroying the master or the subtype', async () => {
      const property = await createProperty();
      await agent.post(`/api/properties/${property.id}/publish`).expect(200);

      const archived = await agent
        .post(`/api/properties/${property.id}/archive`)
        .send({ reason: 'Withdrawn by owner' })
        .expect(200);
      expect(archived.body.publicationStatus).toBe('ARCHIVED');

      // Nothing is deleted.
      expect(await context.prisma.property.count()).toBe(1);
      expect(await context.prisma.saleProperty.count()).toBe(1);

      const events = await context.prisma.propertyArchive.findMany();
      expect(events).toHaveLength(1);
      expect(events[0].previous_status).toBe('PUBLISHED');
      expect(events[0].previous_availability).toBe('AVAILABLE');
      expect(events[0].archived_by).toBe(
        (await context.prisma.crmUser.findUniqueOrThrow({ where: { email: ADMIN.email } })).id,
      );
      expect(events[0].reason).toBe('Withdrawn by owner');

      const snapshot = events[0].snapshot as Record<string, unknown>;
      expect(snapshot.id).toBe(property.id);
      expect(snapshot.address).toBe('Andheri West');
    });

    it('restores a property to its previous publication state', async () => {
      const property = await createProperty();
      await agent.post(`/api/properties/${property.id}/publish`).expect(200);
      await agent.post(`/api/properties/${property.id}/archive`).send({}).expect(200);

      const restored = await agent.post(`/api/properties/${property.id}/restore`).expect(200);
      expect(restored.body.publicationStatus).toBe('PUBLISHED');
      expect(restored.body.sale).not.toBeNull();
    });

    it('restores a never-published draft back to draft', async () => {
      const property = await createProperty();
      await agent.post(`/api/properties/${property.id}/archive`).send({}).expect(200);

      const restored = await agent.post(`/api/properties/${property.id}/restore`).expect(200);
      expect(restored.body.publicationStatus).toBe('DRAFT');
    });

    it('records a second archive event after a restore', async () => {
      const property = await createProperty();
      await agent.post(`/api/properties/${property.id}/archive`).send({}).expect(200);
      await agent.post(`/api/properties/${property.id}/restore`).expect(200);
      await sleep(20);
      await agent.post(`/api/properties/${property.id}/archive`).send({}).expect(200);

      const events = await context.prisma.propertyArchive.findMany({
        where: { property_id: BigInt(property.id) },
        orderBy: { archived_at: 'asc' },
      });
      expect(events).toHaveLength(2);
    });

    it('prevents editing an archived property', async () => {
      const property = await createProperty();
      await agent.post(`/api/properties/${property.id}/archive`).send({}).expect(200);

      const response = await agent
        .put(`/api/properties/${property.id}`)
        .send({ address: 'New address' })
        .expect(409);
      expect(response.body.message).toContain('Archived');
    });

    it('archives through DELETE without destroying the record', async () => {
      const property = await createProperty();

      const response = await agent.delete(`/api/properties/${property.id}`).expect(200);
      expect(response.body.publicationStatus).toBe('ARCHIVED');

      // The original contract asks for a DELETE endpoint; archiving stays
      // non-destructive, so the master and the subtype survive.
      expect(await context.prisma.property.count()).toBe(1);
      expect(await context.prisma.saleProperty.count()).toBe(1);
      expect(await context.prisma.propertyArchive.count()).toBe(1);

      await agent.delete(`/api/properties/${property.id}`).expect(409);
    });

    it('refuses to archive twice without restoring', async () => {
      const property = await createProperty();
      await agent.post(`/api/properties/${property.id}/archive`).send({}).expect(200);
      await agent.post(`/api/properties/${property.id}/archive`).send({}).expect(409);
    });
  });

  describe('projects and units', () => {
    async function createProject(name: string) {
      return context.prisma.project.create({
        data: { name, city: 'Pune', external_id: name.toLowerCase().replace(/\s+/g, '-') },
      });
    }

    it('links a unit to an existing project', async () => {
      const project = await createProject('Sunrise Residency');

      const property = await createProperty({
        projectId: Number(project.id),
        unitIdentifier: 'A-1203',
      });

      expect(property.projectId).toBe(project.id.toString());
      expect(property.projectName).toBe('Sunrise Residency');
      expect(property.unitIdentifier).toBe('A-1203');

      const row = await context.prisma.property.findUniqueOrThrow({
        where: { id: BigInt(property.id) },
      });
      // The legacy free-text column stays populated for the website.
      expect(row.project).toBe('Sunrise Residency');
    });

    it('rejects a duplicate unit identifier inside the same project', async () => {
      const project = await createProject('Sunrise Residency');
      await createProperty({ projectId: Number(project.id), unitIdentifier: 'A-1203' });

      await agent
        .post('/api/properties')
        .send({
          ...salePayload(),
          projectId: Number(project.id),
          unitIdentifier: 'A-1203',
        })
        .expect(409);
    });

    it('rejects an unknown project', async () => {
      await agent
        .post('/api/properties')
        .send({ ...salePayload(), projectId: 999999 })
        .expect(400);
    });

    it('calculates aggregate availability through queries', async () => {
      const project = await createProject('Sunrise Residency');
      const first = await createProperty({ projectId: Number(project.id), unitIdentifier: 'A-101' });
      const second = await createProperty({ projectId: Number(project.id), unitIdentifier: 'A-102' });
      await createProperty({ projectId: Number(project.id), unitIdentifier: 'A-103' });

      await agent.post(`/api/properties/${first.id}/publish`).expect(200);
      await agent.post(`/api/properties/${second.id}/publish`).expect(200);
      await agent
        .patch(`/api/properties/${second.id}/availability`)
        .send({ availabilityStatus: 'SOLD' })
        .expect(200);

      const inventory = await agent
        .get(`/api/projects/${project.id}/inventory`)
        .expect(200);

      expect(inventory.body.summary.unitCount).toBe(3);
      const availability = Object.fromEntries(
        inventory.body.summary.byAvailability.map(
          (row: { availabilityStatus: string; count: number }) => [row.availabilityStatus, row.count],
        ),
      );
      expect(availability.AVAILABLE).toBe(2);
      expect(availability.SOLD).toBe(1);

      const projects = await agent.get('/api/projects').expect(200);
      expect(projects.body.data[0]).toMatchObject({ unitCount: 3, availableCount: 1 });
    });
  });

  describe('listing', () => {
    it('filters by listing type and paginates on the server', async () => {
      await createProperty({ address: 'Andheri West' });
      await createProperty({ address: 'Bandra' });
      await createProperty({ listingType: 'RENT', price: 30_000, address: 'Kharadi' });

      const rentals = await agent.get('/api/properties?listingType=RENT').expect(200);
      expect(rentals.body.meta.total).toBe(1);
      expect(rentals.body.data[0].listingType).toBe('RENT');

      const firstPage = await agent.get('/api/properties?pageSize=2&page=1').expect(200);
      expect(firstPage.body.data).toHaveLength(2);
      expect(firstPage.body.meta).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });

      const secondPage = await agent.get('/api/properties?pageSize=2&page=2').expect(200);
      expect(secondPage.body.data).toHaveLength(1);
    });

    it('searches across address and city', async () => {
      await createProperty({ address: 'Andheri West', city: 'Mumbai' });
      await createProperty({ address: 'Kharadi', city: 'Pune' });

      const response = await agent.get('/api/properties?search=Pune').expect(200);
      expect(response.body.meta.total).toBe(1);
      expect(response.body.data[0].city).toBe('Pune');
    });

    it('rejects an invalid page size', async () => {
      await agent.get('/api/properties?pageSize=500').expect(400);
    });
  });

  describe('concurrent edits', () => {
    it('rejects a stale update', async () => {
      const property = await createProperty();
      const staleUpdatedAt = property.updatedAt;

      await sleep(20);

      await agent
        .put(`/api/properties/${property.id}`)
        .send({ address: 'First change', expectedUpdatedAt: staleUpdatedAt })
        .expect(200);

      const conflict = await agent
        .put(`/api/properties/${property.id}`)
        .send({ address: 'Second change', expectedUpdatedAt: staleUpdatedAt })
        .expect(409);

      expect(conflict.body.message).toContain('changed by someone else');
    });
  });

  describe('public read access', () => {
    it('exposes only published listings and hides sold ones from search', async () => {
      const published = await createProperty({ address: 'Visible' });
      const sold = await createProperty({ address: 'Sold' });
      await createProperty({ address: 'Still a draft' });

      await agent.post(`/api/properties/${published.id}/publish`).expect(200);
      await agent.post(`/api/properties/${sold.id}/publish`).expect(200);
      await agent
        .patch(`/api/properties/${sold.id}/availability`)
        .send({ availabilityStatus: 'SOLD' })
        .expect(200);

      const list = await request(app.getHttpServer()).get('/api/public/properties').expect(200);
      expect(list.body.meta.total).toBe(1);
      expect(list.body.data[0].address).toBe('Visible');

      // The sold listing stays reachable by id.
      const detail = await request(app.getHttpServer())
        .get(`/api/public/properties/${sold.id}`)
        .expect(200);
      expect(detail.body.availabilityStatus).toBe('SOLD');

      await request(app.getHttpServer())
        .get(`/api/public/properties/${published.id}`)
        .expect(200);

      const drafts = await request(app.getHttpServer()).get('/api/public/properties').expect(200);
      expect(
        drafts.body.data.some((row: { publicationStatus: string }) => row.publicationStatus !== 'PUBLISHED'),
      ).toBe(false);
    });
  });
});
