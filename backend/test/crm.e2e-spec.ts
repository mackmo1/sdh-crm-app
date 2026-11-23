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

describe('CRM modules (e2e)', () => {
  let context: TestContext;
  let app: INestApplication;
  let agent: Awaited<ReturnType<typeof login>>;

  const leadPayload = (overrides: Record<string, unknown> = {}) => ({
    name: 'Rohit Sharma',
    phone: '+919820000001',
    email: 'rohit@example.test',
    location: 'Andheri West, Mumbai',
    priority: 'HIGH',
    who: 'buyer',
    intent: 'buy',
    ...overrides,
  });

  async function createLead(overrides: Record<string, unknown> = {}) {
    const response = await agent.post('/api/leads').send(leadPayload(overrides)).expect(201);
    return response.body;
  }

  async function createPropertyForMatching(price: number, rooms = '2BHK', city = 'Mumbai') {
    const response = await agent
      .post('/api/properties')
      .send({ listingType: 'SALE', city, address: `${rooms} in ${city}`, rooms, price })
      .expect(201);
    await agent.post(`/api/properties/${response.body.id}/publish`).expect(200);
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

  describe('contacts', () => {
    it('creates and lists contacts', async () => {
      await agent
        .post('/api/contacts')
        .send({ name: 'Anita Desai', category: 'SELLER', phone: '+919820000010', email: 'anita@example.test' })
        .expect(201);

      const list = await agent.get('/api/contacts').expect(200);
      expect(list.body.meta.total).toBe(1);
      expect(list.body.data[0]).toMatchObject({ name: 'Anita Desai', category: 'SELLER', leadCount: 0 });
    });

    it('rejects a duplicate phone number', async () => {
      await agent
        .post('/api/contacts')
        .send({ name: 'First', category: 'BUYER', phone: '+919820000011' })
        .expect(201);

      const duplicate = await agent
        .post('/api/contacts')
        .send({ name: 'Second', category: 'TENANT', phone: '+919820000011' })
        .expect(409);

      expect(duplicate.body.message).toContain('already exists');
    });

    it('updates a contact', async () => {
      const created = await agent
        .post('/api/contacts')
        .send({ name: 'Anita Desai', category: 'SELLER' })
        .expect(201);

      const updated = await agent
        .put(`/api/contacts/${created.body.id}`)
        .send({ city: 'Pune' })
        .expect(200);

      expect(updated.body.city).toBe('Pune');
    });
  });

  describe('leads', () => {
    it('creates a lead with an initial stage history entry', async () => {
      const lead = await createLead();
      expect(lead.stage).toBe('NEW');
      expect(lead.stageHistory).toHaveLength(1);
      expect(lead.stageHistory[0].toStage).toBe('NEW');
    });

    it('lists unassigned leads', async () => {
      await createLead();
      const list = await agent.get('/api/leads?assignment=unassigned').expect(200);
      expect(list.body.meta.total).toBe(1);
    });

    it('assigns a lead and records assignment history', async () => {
      const staff = await createStaffUser(context.prisma, {
        email: 'staff@step360d.test',
        password: 'StaffPassword123',
        role: 'data_user',
        module: 'lead',
      });
      const lead = await createLead();

      const assigned = await agent
        .post(`/api/leads/${lead.id}/assign`)
        .send({ assignedTo: staff.id })
        .expect(200);

      expect(assigned.body.assignedToName).toBe('Test User');
      expect(assigned.body.assignments).toHaveLength(1);

      await agent.post(`/api/leads/${lead.id}/assign`).send({ assignedTo: staff.id }).expect(409);
    });

    it('moves a lead between stages and requires a hold reason', async () => {
      const lead = await createLead();

      const moved = await agent
        .post(`/api/leads/${lead.id}/stage`)
        .send({ stage: 'CONTACTED' })
        .expect(200);
      expect(moved.body.stage).toBe('CONTACTED');

      await agent.post(`/api/leads/${lead.id}/stage`).send({ stage: 'ON_HOLD' }).expect(400);

      const held = await agent
        .post(`/api/leads/${lead.id}/stage`)
        .send({ stage: 'ON_HOLD', onHoldReason: 'Waiting for documents' })
        .expect(200);
      expect(held.body.onHoldReason).toBe('Waiting for documents');
    });

    it('closes a lead as won and reopens it with a reason', async () => {
      const lead = await createLead();

      const won = await agent
        .post(`/api/leads/${lead.id}/close`)
        .send({ outcome: 'SALE' })
        .expect(200);
      expect(won.body.stage).toBe('WON');
      expect(won.body.closureOutcome).toBe('SALE');
      expect(won.body.closedAt).toBeTruthy();

      await agent.post(`/api/leads/${lead.id}/close`).send({ outcome: 'SALE' }).expect(409);

      const reopened = await agent
        .post(`/api/leads/${lead.id}/reopen`)
        .send({ reason: 'Buyer returned' })
        .expect(200);
      expect(reopened.body.stage).not.toBe('WON');
      expect(reopened.body.reopenCount).toBe(1);
      expect(reopened.body.stageHistory.length).toBeGreaterThanOrEqual(3);
    });

    it('requires a loss reason when marking a lead lost', async () => {
      const lead = await createLead();
      await agent.post(`/api/leads/${lead.id}/close`).send({ outcome: 'LOST' }).expect(400);

      const lost = await agent
        .post(`/api/leads/${lead.id}/close`)
        .send({ outcome: 'LOST', lossReason: 'Budget too low' })
        .expect(200);
      expect(lost.body.stage).toBe('LOST');
    });
  });

  describe('requirements and matching', () => {
    it('adds a requirement, matches published properties and shortlists one', async () => {
      const property = await createPropertyForMatching(25_000_000);
      await createPropertyForMatching(90_000_000, '4BHK');
      const lead = await createLead();

      const requirement = await agent
        .post(`/api/leads/${lead.id}/requirements`)
        .send({ intent: 'BUY', budgetMin: 10_000_000, budgetMax: 30_000_000, locations: 'Mumbai', bedrooms: '2BHK' })
        .expect(201);

      const matches = await agent
        .get(`/api/leads/${lead.id}/requirements/${requirement.body.id}/matches`)
        .expect(200);

      expect(matches.body.data).toHaveLength(1);
      expect(matches.body.data[0].id).toBe(property.id);

      const shortlisted = await agent
        .post(`/api/leads/${lead.id}/requirements/${requirement.body.id}/shortlist`)
        .send({ propertyId: Number(property.id) })
        .expect(200);
      expect(shortlisted.body.shortlist).toContain(property.id);

      const removed = await agent
        .delete(`/api/leads/${lead.id}/requirements/${requirement.body.id}/shortlist/${property.id}`)
        .expect(200);
      expect(removed.body.shortlist).toHaveLength(0);
    });

    it('rejects an inverted budget range', async () => {
      const lead = await createLead();
      await agent
        .post(`/api/leads/${lead.id}/requirements`)
        .send({ intent: 'BUY', budgetMin: 50_000_000, budgetMax: 10_000_000 })
        .expect(400);
    });
  });

  describe('interactions', () => {
    it('records an interaction on the timeline', async () => {
      const lead = await createLead();
      await agent
        .post(`/api/leads/${lead.id}/interactions`)
        .send({ type: 'CALL', summary: 'Discussed budget', outcome: 'Interested' })
        .expect(201);

      const detail = await agent.get(`/api/leads/${lead.id}`).expect(200);
      expect(detail.body.interactions).toHaveLength(1);
      expect(detail.body.interactions[0].summary).toBe('Discussed budget');
    });
  });

  describe('follow-up tasks', () => {
    it('creates a task, lists it as overdue and completes it', async () => {
      const lead = await createLead();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const task = await agent
        .post('/api/tasks')
        .send({ title: 'Call back', leadId: Number(lead.id), dueAt: yesterday })
        .expect(201);

      const overdue = await agent.get('/api/tasks?view=overdue').expect(200);
      expect(overdue.body.meta.total).toBe(1);

      const detail = await agent.get(`/api/leads/${lead.id}`).expect(200);
      expect(detail.body.tasks).toHaveLength(1);

      await agent
        .post(`/api/tasks/${task.body.id}/complete`)
        .send({ completionNotes: 'Spoke to the buyer' })
        .expect(200);

      const remaining = await agent.get('/api/tasks?view=overdue').expect(200);
      expect(remaining.body.meta.total).toBe(0);
    });
  });

  describe('site visits', () => {
    it('schedules, reschedules and completes a visit', async () => {
      const property = await createPropertyForMatching(20_000_000);
      const lead = await createLead();
      const later = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

      const visit = await agent
        .post('/api/site-visits')
        .send({ leadId: Number(lead.id), propertyId: Number(property.id), scheduledAt: later })
        .expect(201);

      const rescheduled = await agent
        .post(`/api/site-visits/${visit.body.id}/reschedule`)
        .send({ scheduledAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString() })
        .expect(200);
      expect(rescheduled.body.rescheduleCount).toBe(1);

      const completed = await agent
        .post(`/api/site-visits/${visit.body.id}/complete`)
        .send({ feedback: 'Liked the flat', nextSteps: 'Send price sheet' })
        .expect(200);
      expect(completed.body.status).toBe('COMPLETED');

      await agent.post(`/api/site-visits/${visit.body.id}/complete`).send({}).expect(409);
    });
  });

  describe('dashboard and reports', () => {
    it('returns live metrics and staff performance', async () => {
      const lead = await createLead();
      await agent.post(`/api/leads/${lead.id}/close`).send({ outcome: 'SALE' }).expect(200);

      const dashboard = await agent.get('/api/dashboard').expect(200);
      expect(dashboard.body.totals.totalLeads).toBe(1);
      expect(dashboard.body.totals.wonLeads).toBe(1);
      expect(dashboard.body.conversion.winRate).toBe(100);
      expect(dashboard.body.staffPerformance.length).toBeGreaterThanOrEqual(1);

      const report = await agent.get('/api/reports/staff').expect(200);
      expect(Array.isArray(report.body)).toBe(true);
    });
  });

  describe('staff management', () => {
    it('creates a staff account that can sign in and is module-restricted', async () => {
      const created = await agent
        .post('/api/staff')
        .send({
          name: 'Lead Desk',
          email: 'leaddesk@step360d.test',
          role: 'data_user',
          module: 'lead',
          password: 'LeadDeskPass123',
        })
        .expect(201);

      const staffAgent = await login(app, 'leaddesk@step360d.test', 'LeadDeskPass123');
      await staffAgent.get('/api/leads').expect(200);
      await staffAgent.get('/api/properties').expect(403);
      await staffAgent.get('/api/staff').expect(403);

      const deactivated = await agent
        .put(`/api/staff/${created.body.id}`)
        .send({ active: false })
        .expect(200);
      expect(deactivated.body.active).toBe(false);

      await staffAgent.get('/api/leads').expect(401);
    });

    it('rejects a duplicate staff email', async () => {
      await agent
        .post('/api/staff')
        .send({ name: 'A', email: 'dup@step360d.test', role: 'data_user', module: 'lead', password: 'Password123' })
        .expect(201);

      await agent
        .post('/api/staff')
        .send({ name: 'B', email: 'dup@step360d.test', role: 'data_user', module: 'lead', password: 'Password123' })
        .expect(409);
    });
  });
});
