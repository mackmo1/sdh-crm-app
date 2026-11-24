import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.module.js';
import { buildMeta, optionalText, pageSchema } from './crm.helpers.js';

export const contactCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(160),
  category: z.enum(['BUYER', 'SELLER', 'LANDLORD', 'TENANT', 'BUILDER']),
  email: z.preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    z.string().trim().email('Enter a valid email address').max(200).nullable().optional(),
  ),
  phone: optionalText(20),
  company: optionalText(120),
  city: optionalText(120),
  address: optionalText(500),
  notes: optionalText(4000),
});

export const contactUpdateSchema = contactCreateSchema.partial();

export const contactListQuerySchema = z.object({
  ...pageSchema,
  search: z.string().trim().max(200).optional(),
  category: z.enum(['BUYER', 'SELLER', 'LANDLORD', 'TENANT', 'BUILDER']).optional(),
  active: z.enum(['true', 'false']).optional(),
});

export type ContactCreateInput = z.infer<typeof contactCreateSchema>;

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: ContactCreateInput, actorId: string) {
    await this.assertNoDuplicate(input.phone ?? null, input.email ?? null, null);

    const contact = await this.prisma.contact.create({
      data: {
        name: input.name,
        category: input.category,
        email: input.email ?? null,
        phone: input.phone ?? null,
        company: input.company ?? null,
        city: input.city ?? null,
        address: input.address ?? null,
        notes: input.notes ?? null,
        created_by: actorId,
      },
    });

    return this.toDto(contact);
  }

  async update(id: bigint, input: z.infer<typeof contactUpdateSchema>) {
    const existing = await this.prisma.contact.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contact not found');

    const nextPhone = input.phone === undefined ? existing.phone : input.phone;
    const nextEmail = input.email === undefined ? existing.email : input.email;
    await this.assertNoDuplicate(nextPhone ?? null, nextEmail ?? null, id);

    const contact = await this.prisma.contact.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.company !== undefined ? { company: input.company } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    return this.toDto(contact);
  }

  async list(query: z.infer<typeof contactListQuerySchema>) {
    const where = {
      ...(query.category ? { category: query.category } : {}),
      ...(query.active ? { active: query.active === 'true' } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { phone: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { company: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { _count: { select: { leads: true } } },
      }),
      this.prisma.contact.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({ ...this.toDto(row), leadCount: row._count.leads })),
      meta: buildMeta(query.page, query.pageSize, total),
    };
  }

  async findOne(id: bigint) {
    const contact = await this.prisma.contact.findUnique({
      where: { id },
      include: {
        leads: {
          orderBy: { created_at: 'desc' },
          select: { id: true, name: true, phone: true, stage: true, priority: true, created_at: true },
        },
        interactions: { orderBy: { occurred_at: 'desc' }, take: 50 },
        tasks: { orderBy: { due_at: 'asc' }, take: 50 },
      },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    return {
      ...this.toDto(contact),
      leads: contact.leads.map((lead) => ({
        id: lead.id.toString(),
        name: lead.name,
        phone: lead.phone,
        stage: lead.stage,
        priority: lead.priority,
        createdAt: lead.created_at.toISOString(),
      })),
      interactions: contact.interactions.map((interaction) => ({
        id: interaction.id.toString(),
        type: interaction.type,
        occurredAt: interaction.occurred_at.toISOString(),
        summary: interaction.summary,
        outcome: interaction.outcome,
        nextAction: interaction.next_action,
      })),
      tasks: contact.tasks.map((task) => ({
        id: task.id.toString(),
        title: task.title,
        dueAt: task.due_at.toISOString(),
        status: task.status,
      })),
    };
  }

  async options() {
    const contacts = await this.prisma.contact.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      take: 500,
      select: { id: true, name: true, phone: true, category: true },
    });
    return contacts.map((contact) => ({
      id: contact.id.toString(),
      name: contact.name,
      phone: contact.phone,
      category: contact.category,
    }));
  }

  private async assertNoDuplicate(phone: string | null, email: string | null, exclude: bigint | null) {
    const conditions = [];
    if (phone) conditions.push({ phone });
    if (email) conditions.push({ email });
    if (conditions.length === 0) return;

    const duplicate = await this.prisma.contact.findFirst({
      where: {
        OR: conditions,
        ...(exclude ? { id: { not: exclude } } : {}),
      },
    });

    if (duplicate) {
      throw new ConflictException(
        `A contact with the same ${duplicate.phone === phone ? 'phone number' : 'email address'} already exists (${duplicate.name})`,
      );
    }
  }

  private toDto(contact: {
    id: bigint;
    name: string;
    email: string | null;
    phone: string | null;
    category: string;
    company: string | null;
    city: string | null;
    address: string | null;
    notes: string | null;
    active: boolean;
    created_at: Date;
    updated_at: Date;
  }) {
    return {
      id: contact.id.toString(),
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      category: contact.category,
      company: contact.company,
      city: contact.city,
      address: contact.address,
      notes: contact.notes,
      active: contact.active,
      createdAt: contact.created_at.toISOString(),
      updatedAt: contact.updated_at.toISOString(),
    };
  }
}
