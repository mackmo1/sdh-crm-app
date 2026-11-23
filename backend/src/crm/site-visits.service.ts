import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.module.js';
import { buildMeta, endOfDay, optionalText, pageSchema, startOfDay } from './crm.helpers.js';

export const siteVisitCreateSchema = z.object({
  leadId: z.coerce.number().int().min(1),
  propertyId: z.coerce.number().int().min(1),
  assignedTo: optionalText(64),
  scheduledAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date and time'),
  notes: optionalText(2000),
});

export const siteVisitRescheduleSchema = z.object({
  scheduledAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date and time'),
  reason: optionalText(500),
});

export const siteVisitOutcomeSchema = z.object({
  feedback: optionalText(2000),
  nextSteps: optionalText(1000),
});

export const siteVisitListQuerySchema = z.object({
  ...pageSchema,
  view: z.enum(['upcoming', 'today', 'past', 'all']).default('upcoming'),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  assignedTo: z.string().trim().max(64).optional(),
  leadId: z.coerce.number().int().min(1).optional(),
});

@Injectable()
export class SiteVisitsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: z.infer<typeof siteVisitCreateSchema>, actorId: string) {
    const [lead, property] = await Promise.all([
      this.prisma.lead.findUnique({ where: { id: BigInt(input.leadId) } }),
      this.prisma.property.findUnique({ where: { id: BigInt(input.propertyId) } }),
    ]);
    if (!lead) throw new BadRequestException('Lead does not exist');
    if (!property) throw new BadRequestException('Property does not exist');

    if (input.assignedTo) {
      const user = await this.prisma.crmUser.findUnique({ where: { id: input.assignedTo } });
      if (!user || !user.active) throw new BadRequestException('Selected staff member is not available');
    }

    const visit = await this.prisma.siteVisit.create({
      data: {
        lead_id: BigInt(input.leadId),
        property_id: BigInt(input.propertyId),
        assigned_to: input.assignedTo ?? actorId,
        scheduled_at: new Date(input.scheduledAt),
        created_by: actorId,
      },
      include: { lead: { select: { id: true, name: true } }, property: { select: { address: true, city: true } } },
    });

    return this.toDto(visit);
  }

  async list(query: z.infer<typeof siteVisitListQuerySchema>) {
    const now = new Date();
    const where: Prisma.SiteVisitWhereInput = {};

    if (query.view === 'today') {
      where.scheduled_at = { gte: startOfDay(now), lte: endOfDay(now) };
    } else if (query.view === 'upcoming') {
      where.scheduled_at = { gt: endOfDay(now) };
      where.status = 'SCHEDULED';
    } else if (query.view === 'past') {
      where.scheduled_at = { lte: endOfDay(now) };
    }

    if (query.status) where.status = query.status;
    if (query.assignedTo) where.assigned_to = query.assignedTo;
    if (query.leadId) where.lead_id = BigInt(query.leadId);

    const [rows, total] = await Promise.all([
      this.prisma.siteVisit.findMany({
        where,
        orderBy: { scheduled_at: query.view === 'past' ? 'desc' : 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          lead: { select: { id: true, name: true, phone: true, stage: true } },
          property: { select: { id: true, address: true, city: true } },
        },
      }),
      this.prisma.siteVisit.count({ where }),
    ]);

    const staff = await this.staffDirectory(rows.map((row) => row.assigned_to));

    return {
      data: rows.map((row) => ({
        ...this.toDto(row),
        assignedToName: row.assigned_to ? (staff.get(row.assigned_to) ?? null) : null,
        lead: { id: row.lead.id.toString(), name: row.lead.name, phone: row.lead.phone, stage: row.lead.stage },
        property: { id: row.property.id.toString(), address: row.property.address, city: row.property.city },
      })),
      meta: buildMeta(query.page, query.pageSize, total),
    };
  }

  async reschedule(id: bigint, input: z.infer<typeof siteVisitRescheduleSchema>) {
    const visit = await this.findVisit(id);
    if (visit.status !== 'SCHEDULED') {
      throw new ConflictException('Only a scheduled visit can be rescheduled');
    }

    const updated = await this.prisma.siteVisit.update({
      where: { id },
      data: {
        scheduled_at: new Date(input.scheduledAt),
        rescheduled_from: visit.scheduled_at,
        reschedule_count: { increment: 1 },
        next_steps: input.reason ?? visit.next_steps,
      },
    });

    return this.toDto(updated);
  }

  async cancel(id: bigint, reason?: string) {
    const visit = await this.findVisit(id);
    if (visit.status !== 'SCHEDULED') {
      throw new ConflictException('Only a scheduled visit can be cancelled');
    }

    const updated = await this.prisma.siteVisit.update({
      where: { id },
      data: { status: 'CANCELLED', completed_at: new Date(), next_steps: reason ?? visit.next_steps },
    });

    return this.toDto(updated);
  }

  async complete(id: bigint, input: z.infer<typeof siteVisitOutcomeSchema>) {
    const visit = await this.findVisit(id);
    if (visit.status !== 'SCHEDULED') {
      throw new ConflictException('Only a scheduled visit can be completed');
    }

    const updated = await this.prisma.siteVisit.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completed_at: new Date(),
        feedback: input.feedback ?? null,
        next_steps: input.nextSteps ?? null,
      },
    });

    return this.toDto(updated);
  }

  async noShow(id: bigint, input: z.infer<typeof siteVisitOutcomeSchema>) {
    const visit = await this.findVisit(id);
    if (visit.status !== 'SCHEDULED') {
      throw new ConflictException('Only a scheduled visit can be marked as a no-show');
    }

    const updated = await this.prisma.siteVisit.update({
      where: { id },
      data: {
        status: 'NO_SHOW',
        completed_at: new Date(),
        feedback: input.feedback ?? null,
        next_steps: input.nextSteps ?? null,
      },
    });

    return this.toDto(updated);
  }

  private async findVisit(id: bigint) {
    const visit = await this.prisma.siteVisit.findUnique({ where: { id } });
    if (!visit) throw new NotFoundException('Site visit not found');
    return visit;
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

  private toDto(visit: {
    id: bigint;
    lead_id: bigint;
    property_id: bigint;
    assigned_to: string | null;
    scheduled_at: Date;
    status: string;
    feedback: string | null;
    next_steps: string | null;
    rescheduled_from: Date | null;
    reschedule_count: number;
    completed_at: Date | null;
    created_at: Date;
  }) {
    return {
      id: visit.id.toString(),
      leadId: visit.lead_id.toString(),
      propertyId: visit.property_id.toString(),
      assignedTo: visit.assigned_to,
      scheduledAt: visit.scheduled_at.toISOString(),
      status: visit.status,
      feedback: visit.feedback,
      nextSteps: visit.next_steps,
      rescheduledFrom: visit.rescheduled_from?.toISOString() ?? null,
      rescheduleCount: visit.reschedule_count,
      completedAt: visit.completed_at?.toISOString() ?? null,
      createdAt: visit.created_at.toISOString(),
    };
  }
}

