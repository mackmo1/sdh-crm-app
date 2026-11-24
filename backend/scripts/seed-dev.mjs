#!/usr/bin/env node
/**
 * Development-only sample data.
 *
 * Refuses to run in production and will not touch a database that already has
 * leads unless `--force` is passed. Run it explicitly:
 *
 *   npm run seed:dev            (adds sample data)
 *   npm run seed:dev -- --force (adds anyway, even if leads exist)
 *
 * Everything it creates is tagged with source "seed" so it can be identified
 * and removed without touching real records.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const SOURCE = 'seed';

function loadDotEnv() {
  if (process.env.DATABASE_URL) return;
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const contents = readFileSync(join(root, '.env'), 'utf8');
    for (const line of contents.split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      if (process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    // Fall back to the ambient environment.
  }
}

const CONTACTS = [
  ['Rohit Sharma', 'BUYER', '+919820000101', 'rohit.sharma@example.test', 'Andheri West'],
  ['Priya Nair', 'BUYER', '+919820000102', 'priya.nair@example.test', 'Powai'],
  ['Vikram Rao', 'SELLER', '+919820000103', 'vikram.rao@example.test', 'Bandra'],
  ['Meera Iyer', 'LANDLORD', '+919820000104', 'meera.iyer@example.test', 'Kharadi'],
  ['Arjun Patel', 'TENANT', '+919820000105', 'arjun.patel@example.test', 'Baner'],
  ['Skyline Developers', 'BUILDER', '+919820000106', 'sales@skylinedev.example.test', 'Pune'],
  ['Fatima Sheikh', 'TENANT', '+919820000107', 'fatima.sheikh@example.test', 'Wakad'],
  ['Karan Mehta', 'BUYER', '+919820000108', 'karan.mehta@example.test', 'Kharghar'],
];

const LEADS = [
  ['Rohit Sharma', '+919820000101', 'rohit.sharma@example.test', 'Andheri West, Mumbai', 'QUALIFIED', 'HIGH', 'Buyer looking for a 3BHK near the metro.'],
  ['Priya Nair', '+919820000102', 'priya.nair@example.test', 'Powai, Mumbai', 'CONTACTED', 'MEDIUM', 'Comparing options in Powai and Chandivali.'],
  ['Arjun Patel', '+919820000105', 'arjun.patel@example.test', 'Baner, Pune', 'SITE_VISIT', 'HIGH', 'Wants a furnished 2BHK close to Hinjewadi.'],
  ['Fatima Sheikh', '+919820000107', 'fatima.sheikh@example.test', 'Wakad, Pune', 'NEGOTIATION', 'HIGH', 'Negotiating rent on a 1BHK.'],
  ['Karan Mehta', '+919820000108', 'karan.mehta@example.test', 'Kharghar, Navi Mumbai', 'NEW', 'MEDIUM', 'First enquiry from the website.'],
  ['Nilesh Gupta', '+919820000109', 'nilesh.gupta@example.test', 'Thane', 'NEW', 'LOW', 'Early stage, budget not confirmed.'],
  ['Sneha Kulkarni', '+919820000110', 'sneha.kulkarni@example.test', 'Vashi', 'ON_HOLD', 'MEDIUM', 'Waiting for a home loan sanction.'],
  ["Imran Qureshi", '+919820000111', 'imran.qureshi@example.test', 'Bandra, Mumbai', 'WON', 'HIGH', 'Closed a 2BHK sale in Bandra.'],
  ['Deepa Menon', '+919820000112', 'deepa.menon@example.test', 'Chembur', 'LOST', 'LOW', 'Chose a property outside our inventory.'],
  ['Sameer Joshi', '+919820000113', 'sameer.joshi@example.test', 'Kothrud, Pune', 'CONTACTED', 'MEDIUM', 'Looking to rent a 3BHK.'],
];

async function main() {
  loadDotEnv();
  if (!process.env.DATABASE_URL) {
    console.error('\n✖ DATABASE_URL is not set.\n');
    process.exit(1);
  }
  if (process.env.NODE_ENV === 'production') {
    console.error('\n✖ Refusing to seed a production database.\n');
    process.exit(1);
  }

  const force = process.argv.includes('--force');
  const prisma = new PrismaClient();

  try {
    const existing = await prisma.lead.count({ where: { source: SOURCE } });
    const realLeads = await prisma.lead.count({ where: { source: { not: SOURCE } } });

    if (existing > 0 && !force) {
      console.log(`\nℹ Sample data already present (${existing} leads). Use --force to add more.\n`);
      return;
    }
    if (realLeads > 0 && !force) {
      console.error(
        `\n✖ This database already has ${realLeads} non-sample leads. Re-run with --force if you are sure.\n`,
      );
      process.exit(1);
    }

    const staff = await prisma.crmUser.findMany({ where: { active: true }, select: { id: true, name: true } });
    const assignee = staff[0]?.id ?? null;

    const contacts = [];
    for (const [name, category, phone, email, city] of CONTACTS) {
      const existingContact = await prisma.contact.findFirst({ where: { phone } });
      contacts.push(
        existingContact ??
          (await prisma.contact.create({
            data: { name, category, phone, email, city, created_by: assignee },
          })),
      );
    }

    const projects = await prisma.project.findMany({ take: 2, orderBy: { id: 'asc' } });
    const properties = await prisma.property.findMany({
      where: { publication_status: 'PUBLISHED' },
      take: 5,
      orderBy: { id: 'desc' },
    });

    let created = 0;
    for (let index = 0; index < LEADS.length; index += 1) {
      const [name, phone, email, location, stage, priority, message] = LEADS[index];
      const existingLead = await prisma.lead.findFirst({ where: { phone } });
      if (existingLead) continue;

      const contact = contacts[index % contacts.length];
      const intent = stage === 'LOST' ? 'buy' : index % 3 === 0 ? 'rent' : 'buy';

      const lead = await prisma.lead.create({
        data: {
          name,
          phone,
          email_id: email,
          location,
          who: intent === 'rent' ? 'tenant' : 'buyer',
          intent,
          message,
          status: 'new',
          source: SOURCE,
          priority,
          stage,
          assigned_to: index % 4 === 3 ? null : assignee,
          contact_id: contact?.id ?? null,
          closed_at: stage === 'WON' || stage === 'LOST' ? new Date() : null,
          closure_outcome: stage === 'WON' ? 'SALE' : stage === 'LOST' ? 'LOST' : null,
          loss_reason: stage === 'LOST' ? 'Chose a property outside our inventory' : null,
        },
      });

      await prisma.leadStageHistory.create({
        data: { lead_id: lead.id, from_stage: null, to_stage: 'NEW', changed_by: assignee },
      });
      if (stage !== 'NEW') {
        await prisma.leadStageHistory.create({
          data: { lead_id: lead.id, from_stage: 'NEW', to_stage: stage, changed_by: assignee },
        });
      }
      if (lead.assigned_to) {
        await prisma.leadAssignment.create({
          data: { lead_id: lead.id, assigned_to: lead.assigned_to, assigned_by: assignee },
        });
      }

      await prisma.requirement.create({
        data: {
          lead_id: lead.id,
          intent: intent === 'rent' ? 'RENT' : 'BUY',
          budget_min: intent === 'rent' ? 20000 : 10000000,
          budget_max: intent === 'rent' ? 60000 : 40000000,
          locations: location.split(',')[0].trim(),
          bedrooms: index % 2 === 0 ? '2BHK' : '3BHK',
          timeframe: 'Within 3 months',
          created_by: assignee,
        },
      });

      await prisma.interaction.create({
        data: {
          lead_id: lead.id,
          contact_id: contact?.id ?? null,
          type: index % 2 === 0 ? 'CALL' : 'MESSAGE',
          summary: `Intro call. ${message}`,
          outcome: 'Interested',
          next_action: 'Share matching properties',
          created_by: assignee,
        },
      });

      await prisma.followUpTask.create({
        data: {
          title: `Follow up with ${name.split(' ')[0]}`,
          lead_id: lead.id,
          assigned_to: assignee,
          due_at: new Date(Date.now() + (index % 5 === 0 ? -2 : index % 3) * 24 * 60 * 60 * 1000),
          next_action: 'Share shortlist',
          created_by: assignee,
        },
      });

      if (properties.length > 0 && index % 2 === 0) {
        await prisma.siteVisit.create({
          data: {
            lead_id: lead.id,
            property_id: properties[index % properties.length].id,
            assigned_to: assignee,
            scheduled_at: new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000),
            status: index % 4 === 0 ? 'COMPLETED' : 'SCHEDULED',
            feedback: index % 4 === 0 ? 'Liked the layout, discussing price.' : null,
            next_steps: index % 4 === 0 ? 'Send price sheet' : null,
            created_by: assignee,
          },
        });
      }

      created += 1;
    }

    console.log(
      `\n✔ Seeded ${contacts.length} contacts and ${created} leads` +
        `${projects.length ? ` across ${projects.length} existing projects` : ''}.\n` +
        '   All sample leads are tagged with source "seed".\n',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
