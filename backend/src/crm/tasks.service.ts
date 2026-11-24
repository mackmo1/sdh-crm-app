import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.module.js';
import { buildMeta, endOfDay, optionalDateTime, optionalId, optionalText, pageSchema, startOfDay } from './crm.helpers.js';

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, 'A title is required').max(200),
  description: optionalText(2000),
  leadId: optionalId(),
  contactId: optionalId(),
  assignedTo: optionalText(64),
  dueAt: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid due date'),
  nextAction: optionalText(500),
});

export const taskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: optionalText(2000),
  assignedTo: optionalText(64),
  dueAt: optionalDateTime(),
  nextAction: optionalText(500),
});

export const taskCompleteSchema = z.object({
  completionNotes: optionalText(2000),
  nextAction: optionalText(500),
});

export const taskListQuerySchema = z.object({
  ...pageSchema,
  view: z.enum(['today', 'upcoming', 'overdue', 'open', 'completed', 'all']).default('open'),
  assignedTo: z.string().trim().max(64).optional(),
  leadId: z.coerce.number().int().min(1).optional(),
});

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: z.infer<typeof taskCreateSchema>, actorId: string) {
    await this.assertReferences(input.leadId ?? null, input.contactId ?? null, input.assignedTo ?? null);

    const task = await this.prisma.followUpTask.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        lead_id: input.leadId ? BigInt(input.leadId) : null,
        contact_id: input.contactId ? BigInt(input.contactId) : null,
        assigned_to: input.assignedTo ?? actorId,
        due_at: new Date(input.dueAt),
        next_action: input.nextAction ?? null,
        created_by: actorId,
      },
    });

    return this.toDto(task);
  }

  async list(query: z.infer<typeof taskListQuerySchema>) {
    const now = new Date();
    const where: Prisma.FollowUpTaskWhereInput = {};

    switch (query.view) {
      case 'overdue':
        where.status = 'OPEN';
        where.due_at = { lt: startOfDay(now) };
        break;
      case 'today':
        where.status = 'OPEN';
        where.due_at = { gte: startOfDay(now), lte: endOfDay(now) };
        break;
      case 'upcoming':
        where.status = 'OPEN';
        where.due_at = { gt: endOfDay(now) };
        break;
      case 'completed':
        where.status = 'COMPLETED';
        break;
      case 'all':
        break;
      case 'open':
      default:
        where.status = 'OPEN';
        break;
    }

    if (query.assignedTo) where.assigned_to = query.assignedTo;
    if (query.leadId) where.lead_id = BigInt(query.leadId);

    const [rows, total] = await Promise.all([
      this.prisma.followUpTask.findMany({
        where,
        orderBy: { due_at: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { lead: { select: { id: true, name: true, phone: true, stage: true } } },
      }),
      this.prisma.followUpTask.count({ where }),
    ]);

    const staff = await this.staffDirectory(rows.map((row) => row.assigned_to));

    return {
      data: rows.map((row) => ({
        ...this.toDto(row),
        overdue: row.status === 'OPEN' && row.due_at.getTime() < now.getTime(),
        assignedToName: row.assigned_to ? (staff.get(row.assigned_to) ?? null) : null,
        lead: row.lead
          ? { id: row.lead.id.toString(), name: row.lead.name, phone: row.lead.phone, stage: row.lead.stage }
          : null,
      })),
      meta: buildMeta(query.page, query.pageSize, total),
    };
  }

  async update(id: bigint, input: z.infer<typeof taskUpdateSchema>) {
    const existing = await this.prisma.followUpTask.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Task not found');

    const task = await this.prisma.followUpTask.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.assignedTo !== undefined ? { assigned_to: input.assignedTo } : {}),
        ...(input.dueAt !== undefined && input.dueAt !== null ? { due_at: new Date(input.dueAt) } : {}),
        ...(input.nextAction !== undefined ? { next_action: input.nextAction } : {}),
      },
    });

    return this.toDto(task);
  }

  async complete(id: bigint, input: z.infer<typeof taskCompleteSchema>) {
    const existing = await this.prisma.followUpTask.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Task not found');
    if (existing.status !== 'OPEN') throw new ConflictException('Only an open task can be completed');

    const task = await this.prisma.followUpTask.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completed_at: new Date(),
        completion_notes: input.completionNotes ?? null,
        next_action: input.nextAction ?? existing.next_action,
      },
    });

    return this.toDto(task);
  }

  async cancel(id: bigint) {
    const existing = await this.prisma.followUpTask.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Task not found');
    if (existing.status !== 'OPEN') throw new ConflictException('Only an open task can be cancelled');

    const task = await this.prisma.followUpTask.update({
      where: { id },
      data: { status: 'CANCELLED', completed_at: new Date() },
    });

    return this.toDto(task);
  }

  async remove(id: bigint): Promise<void> {
    const existing = await this.prisma.followUpTask.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Task not found');
    await this.prisma.followUpTask.delete({ where: { id } });
  }

  private async assertReferences(
    leadId: number | null,
    contactId: number | null,
    assignedTo: string | null,
  ) {
    if (leadId) {
      const lead = await this.prisma.lead.findUnique({ where: { id: BigInt(leadId) } });
      if (!lead) throw new BadRequestException('Linked lead does not exist');
    }
    if (contactId) {
      const contact = await this.prisma.contact.findUnique({ where: { id: BigInt(contactId) } });
      if (!contact) throw new BadRequestException('Linked contact does not exist');
    }
    if (assignedTo) {
      const user = await this.prisma.crmUser.findUnique({ where: { id: assignedTo } });
      if (!user || !user.active) throw new BadRequestException('Selected staff member is not available');
    }
  }

  private async staffDirectory(ids: (string | null)[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (unique.length === 0) return new Map();
    const users = await this.prisma.crmUser.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map(users.map((user) => [user.id, user.name]));
  }

  private toDto(task: {
    id: bigint;
    title: string;
    description: string | null;
    lead_id: bigint | null;
    contact_id: bigint | null;
    assigned_to: string | null;
    due_at: Date;
    status: string;
    completed_at: Date | null;
    completion_notes: string | null;
    next_action: string | null;
    created_at: Date;
  }) {
    return {
      id: task.id.toString(),
      title: task.title,
      description: task.description,
      leadId: task.lead_id?.toString() ?? null,
      contactId: task.contact_id?.toString() ?? null,
      assignedTo: task.assigned_to,
      dueAt: task.due_at.toISOString(),
      status: task.status,
      completedAt: task.completed_at?.toISOString() ?? null,
      completionNotes: task.completion_notes,
      nextAction: task.next_action,
      createdAt: task.created_at.toISOString(),
    };
  }
}
