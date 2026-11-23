import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.module.js';
import { buildMeta } from './crm.helpers.js';
import type {
  LeadListQuery,
  assignLeadSchema,
  changeStageSchema,
  closeLeadSchema,
  interactionCreateSchema,
  leadCreateSchema,
  leadUpdateSchema,
  matchQuerySchema,
  reopenLeadSchema,
  requirementCreateSchema,
  requirementUpdateSchema,
} from './leads.schemas.js';

type LeadCreateInput = z.infer<typeof leadCreateSchema>;
type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;

const LEAD_INCLUDE = {
  contact: true,
  selected_property: { select: { id: true, address: true, city: true } },
  requirements: {
    where: { active: true },
    orderBy: { created_at: 'desc' },
    include: { shortlist: { select: { property_id: true } } },
  },
  tasks: { where: { status: 'OPEN' }, orderBy: { due_at: 'asc' } },
  siteVisits: { orderBy: { scheduled_at: 'desc' }, take: 20 },
  interactions: { orderBy: { occurred_at: 'desc' }, take: 50 },
  stageHistory: { orderBy: { changed_at: 'desc' }, take: 50 },
  assignments: { orderBy: { assigned_at: 'desc' }, take: 50 },
} satisfies Prisma.LeadInclude;

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- create

  async create(input: LeadCreateInput, actorId: string) {
    if (input.contactId) {
      const contact = await this.prisma.contact.findUnique({ where: { id: BigInt(input.contactId) } });
      if (!contact) throw new BadRequestException('Selected contact does not exist');
    }
    if (input.assignedTo) {
      await this.assertAssignableUser(input.assignedTo);
    }

    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          name: input.name,
          phone: input.phone,
          email_id: input.email,
          location: input.location,
          who: input.who,
          intent: input.intent,
          message: input.message ?? null,
          property_type: input.propertyType ?? null,
          bedrooms: input.bedrooms ?? null,
          budget: input.budget ?? null,
          status: 'new',
          source: input.source ?? null,
          priority: input.priority,
          stage: 'NEW',
          contact_id: input.contactId ? BigInt(input.contactId) : null,
          assigned_to: input.assignedTo ?? null,
        },
      });

      await tx.leadStageHistory.create({
        data: { lead_id: lead.id, from_stage: null, to_stage: 'NEW', changed_by: actorId },
      });

      if (input.assignedTo) {
        await tx.leadAssignment.create({
          data: { lead_id: lead.id, assigned_to: input.assignedTo, assigned_by: actorId },
        });
      }

      return this.findOneIn(tx, lead.id);
    });
  }

  // ------------------------------------------------------------------ read

  async list(query: LeadListQuery) {
    const where: Prisma.LeadWhereInput = {};

    if (query.stage) where.stage = query.stage;
    if (query.priority) where.priority = query.priority;
    if (query.source) where.source = { equals: query.source, mode: 'insensitive' };
    if (query.city) where.location = { contains: query.city, mode: 'insensitive' };
    if (query.assignedTo) where.assigned_to = query.assignedTo;
    if (query.assignment === 'unassigned') where.assigned_to = null;
    if (query.assignment === 'assigned') where.assigned_to = { not: null };

    if (query.from || query.to) {
      where.created_at = {};
      if (query.from && !Number.isNaN(Date.parse(query.from))) where.created_at.gte = new Date(query.from);
      if (query.to && !Number.isNaN(Date.parse(query.to))) {
        const to = new Date(query.to);
        to.setHours(23, 59, 59, 999);
        where.created_at.lte = to;
      }
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
        { email_id: { contains: query.search, mode: 'insensitive' } },
        { location: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.LeadOrderByWithRelationInput =
      query.sort === 'createdAt:asc'
        ? { created_at: 'asc' }
        : query.sort === 'updatedAt:desc'
          ? { updated_at: 'desc' }
          : { created_at: 'desc' };

    const [rows, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          _count: { select: { tasks: { where: { status: 'OPEN' } }, requirements: true } },
          tasks: { where: { status: 'OPEN' }, orderBy: { due_at: 'asc' }, take: 1 },
        },
      }),
      this.prisma.lead.count({ where }),
    ]);

    const staff = await this.staffDirectory(rows.map((row) => row.assigned_to));
    const now = Date.now();

    return {
      data: rows.map((row) => {
        const nextTask = row.tasks[0];
        return {
          id: row.id.toString(),
          name: row.name,
          phone: row.phone,
          email: row.email_id,
          location: row.location,
          stage: row.stage,
          priority: row.priority,
          source: row.source,
          assignedTo: row.assigned_to,
          assignedToName: row.assigned_to ? (staff.get(row.assigned_to) ?? null) : null,
          openTaskCount: row._count.tasks,
          requirementCount: row._count.requirements,
          nextTaskDueAt: nextTask ? nextTask.due_at.toISOString() : null,
          overdue: nextTask ? nextTask.due_at.getTime() < now : false,
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
        };
      }),
      meta: buildMeta(query.page, query.pageSize, total),
    };
  }

  async findOne(id: bigint) {
    return this.findOneIn(this.prisma, id);
  }

  async update(id: bigint, input: LeadUpdateInput) {
    const existing = await this.prisma.lead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lead not found');

    if (input.contactId) {
      const contact = await this.prisma.contact.findUnique({ where: { id: BigInt(input.contactId) } });
      if (!contact) throw new BadRequestException('Selected contact does not exist');
    }

    await this.prisma.lead.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.email !== undefined ? { email_id: input.email } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.contactId !== undefined
          ? { contact_id: input.contactId === null ? null : BigInt(input.contactId) }
          : {}),
        ...(input.source !== undefined ? { source: input.source } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.message !== undefined ? { message: input.message } : {}),
        ...(input.propertyType !== undefined ? { property_type: input.propertyType } : {}),
        ...(input.bedrooms !== undefined ? { bedrooms: input.bedrooms } : {}),
        ...(input.budget !== undefined ? { budget: input.budget } : {}),
      },
    });

    return this.findOne(id);
  }

  // ------------------------------------------------------------- assignment

  async assign(id: bigint, input: z.infer<typeof assignLeadSchema>, actorId: string) {
    await this.assertAssignableUser(input.assignedTo);

    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id } });
      if (!lead) throw new NotFoundException('Lead not found');

      const open = await tx.leadAssignment.findFirst({
        where: { lead_id: id, ended_at: null },
        orderBy: { assigned_at: 'desc' },
      });

      if (open && open.assigned_to === input.assignedTo) {
        throw new ConflictException('Lead is already assigned to this staff member');
      }
      if (open) {
        await tx.leadAssignment.update({ where: { id: open.id }, data: { ended_at: new Date() } });
      }

      await tx.leadAssignment.create({
        data: { lead_id: id, assigned_to: input.assignedTo, assigned_by: actorId },
      });
      await tx.lead.update({ where: { id }, data: { assigned_to: input.assignedTo } });

      return this.findOneIn(tx, id);
    });
  }

  // ---------------------------------------------------------------- pipeline

  async changeStage(id: bigint, input: z.infer<typeof changeStageSchema>, actorId: string) {
    if (input.stage === 'ON_HOLD' && !input.onHoldReason) {
      throw new BadRequestException('A reason is required when putting a lead on hold');
    }

    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id } });
      if (!lead) throw new NotFoundException('Lead not found');
      if (lead.stage === 'WON' || lead.stage === 'LOST') {
        throw new ConflictException('Reopen the lead before changing its stage');
      }
      if (lead.stage === input.stage) {
        throw new ConflictException('Lead is already in this stage');
      }

      await tx.lead.update({
        where: { id },
        data: {
          stage: input.stage,
          on_hold_reason: input.stage === 'ON_HOLD' ? (input.onHoldReason ?? null) : null,
        },
      });

      await tx.leadStageHistory.create({
        data: {
          lead_id: id,
          from_stage: lead.stage,
          to_stage: input.stage,
          reason: input.stage === 'ON_HOLD' ? (input.onHoldReason ?? null) : (input.reason ?? null),
          changed_by: actorId,
        },
      });

      return this.findOneIn(tx, id);
    });
  }

  async close(id: bigint, input: z.infer<typeof closeLeadSchema>, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id } });
      if (!lead) throw new NotFoundException('Lead not found');
      if (lead.stage === 'WON' || lead.stage === 'LOST') {
        throw new ConflictException('Lead is already closed');
      }

      const isLost = input.outcome === 'LOST';
      if (isLost && !input.lossReason) {
        throw new BadRequestException('A loss reason is required when marking a lead as lost');
      }

      if (input.selectedPropertyId) {
        const property = await tx.property.findUnique({
          where: { id: BigInt(input.selectedPropertyId) },
        });
        if (!property) throw new BadRequestException('Selected property does not exist');
      }

      await tx.lead.update({
        where: { id },
        data: {
          stage: isLost ? 'LOST' : 'WON',
          closed_at: new Date(),
          closure_outcome: input.outcome,
          loss_reason: isLost ? (input.lossReason ?? null) : null,
          selected_property_id: input.selectedPropertyId
            ? BigInt(input.selectedPropertyId)
            : lead.selected_property_id,
          on_hold_reason: null,
        },
      });

      await tx.leadStageHistory.create({
        data: {
          lead_id: id,
          from_stage: lead.stage,
          to_stage: isLost ? 'LOST' : 'WON',
          reason: isLost ? (input.lossReason ?? null) : null,
          changed_by: actorId,
        },
      });

      return this.findOneIn(tx, id);
    });
  }

  async reopen(id: bigint, input: z.infer<typeof reopenLeadSchema>, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id } });
      if (!lead) throw new NotFoundException('Lead not found');
      if (lead.stage !== 'WON' && lead.stage !== 'LOST') {
        throw new ConflictException('Only a closed lead can be reopened');
      }

      const previous = await tx.leadStageHistory.findFirst({
        where: { lead_id: id, to_stage: { notIn: ['WON', 'LOST'] } },
        orderBy: { changed_at: 'desc' },
      });
      const target = previous?.to_stage ?? 'NEW';

      await tx.lead.update({
        where: { id },
        data: {
          stage: target,
          closed_at: null,
          closure_outcome: null,
          loss_reason: null,
          reopen_count: { increment: 1 },
        },
      });

      await tx.leadStageHistory.create({
        data: {
          lead_id: id,
          from_stage: lead.stage,
          to_stage: target,
          reason: input.reason,
          changed_by: actorId,
        },
      });

      return this.findOneIn(tx, id);
    });
  }

  // ------------------------------------------------------------ interactions

  async addInteraction(
    leadId: bigint,
    input: z.infer<typeof interactionCreateSchema>,
    actorId: string,
  ) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const interaction = await this.prisma.interaction.create({
      data: {
        lead_id: leadId,
        contact_id: input.contactId
          ? BigInt(input.contactId)
          : lead.contact_id,
        type: input.type,
        occurred_at: input.occurredAt ? new Date(input.occurredAt) : new Date(),
        summary: input.summary,
        outcome: input.outcome ?? null,
        next_action: input.nextAction ?? null,
        created_by: actorId,
      },
    });

    return this.toInteractionDto(interaction);
  }

  async listInteractions(leadId: bigint) {
    const rows = await this.prisma.interaction.findMany({
      where: { lead_id: leadId },
      orderBy: { occurred_at: 'desc' },
    });
    const staff = await this.staffDirectory(rows.map((row) => row.created_by));
    return rows.map((row) => ({
      ...this.toInteractionDto(row),
      createdByName: row.created_by ? (staff.get(row.created_by) ?? null) : null,
    }));
  }

  // ------------------------------------------------------------ requirements

  async addRequirement(
    leadId: bigint,
    input: z.infer<typeof requirementCreateSchema>,
    actorId: string,
  ) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');
    this.assertBudgetRange(input.budgetMin ?? null, input.budgetMax ?? null);

    const requirement = await this.prisma.requirement.create({
      data: {
        lead_id: leadId,
        intent: input.intent,
        budget_min: input.budgetMin === null || input.budgetMin === undefined ? null : new Prisma.Decimal(input.budgetMin),
        budget_max: input.budgetMax === null || input.budgetMax === undefined ? null : new Prisma.Decimal(input.budgetMax),
        locations: input.locations ?? null,
        property_type: input.propertyType ?? null,
        bedrooms: input.bedrooms ?? null,
        timeframe: input.timeframe ?? null,
        notes: input.notes ?? null,
        created_by: actorId,
      },
    });

    return this.toRequirementDto(requirement, []);
  }

  async updateRequirement(
    leadId: bigint,
    requirementId: bigint,
    input: z.infer<typeof requirementUpdateSchema>,
  ) {
    const existing = await this.prisma.requirement.findFirst({
      where: { id: requirementId, lead_id: leadId },
      include: { shortlist: { select: { property_id: true } } },
    });
    if (!existing) throw new NotFoundException('Requirement not found');

    const nextMin = input.budgetMin === undefined ? existing.budget_min : input.budgetMin;
    const nextMax = input.budgetMax === undefined ? existing.budget_max : input.budgetMax;
    this.assertBudgetRange(
      nextMin === null ? null : Number(nextMin),
      nextMax === null ? null : Number(nextMax),
    );

    const updated = await this.prisma.requirement.update({
      where: { id: requirementId },
      data: {
        ...(input.intent !== undefined ? { intent: input.intent } : {}),
        ...(input.budgetMin !== undefined
          ? { budget_min: input.budgetMin === null ? null : new Prisma.Decimal(input.budgetMin) }
          : {}),
        ...(input.budgetMax !== undefined
          ? { budget_max: input.budgetMax === null ? null : new Prisma.Decimal(input.budgetMax) }
          : {}),
        ...(input.locations !== undefined ? { locations: input.locations } : {}),
        ...(input.propertyType !== undefined ? { property_type: input.propertyType } : {}),
        ...(input.bedrooms !== undefined ? { bedrooms: input.bedrooms } : {}),
        ...(input.timeframe !== undefined ? { timeframe: input.timeframe } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
      include: { shortlist: { select: { property_id: true } } },
    });

    return this.toRequirementDto(updated, updated.shortlist.map((row) => row.property_id));
  }

  async deleteRequirement(leadId: bigint, requirementId: bigint): Promise<void> {
    const existing = await this.prisma.requirement.findFirst({
      where: { id: requirementId, lead_id: leadId },
    });
    if (!existing) throw new NotFoundException('Requirement not found');
    await this.prisma.requirement.delete({ where: { id: requirementId } });
  }

  async matchRequirement(
    leadId: bigint,
    requirementId: bigint,
    query: z.infer<typeof matchQuerySchema>,
  ) {
    const requirement = await this.prisma.requirement.findFirst({
      where: { id: requirementId, lead_id: leadId },
      include: { shortlist: { select: { property_id: true } } },
    });
    if (!requirement) throw new NotFoundException('Requirement not found');

    // A seller requirement describes stock being offered, not stock to match.
    if (requirement.intent === 'SELL') {
      return { data: [], meta: { total: 0 } };
    }

    const where: Prisma.PropertyWhereInput = {
      publication_status: 'PUBLISHED',
      availability_status: { in: ['AVAILABLE', 'ON_HOLD'] },
      listing_type: requirement.intent === 'RENT' ? 'RENT' : 'SALE',
      ...(requirement.property_type
        ? { type: { contains: requirement.property_type, mode: 'insensitive' } }
        : {}),
      ...(requirement.bedrooms
        ? { rooms: { contains: requirement.bedrooms, mode: 'insensitive' } }
        : {}),
    };

    if (requirement.budget_min !== null || requirement.budget_max !== null) {
      where.price = {
        ...(requirement.budget_min !== null ? { gte: requirement.budget_min } : {}),
        ...(requirement.budget_max !== null ? { lte: requirement.budget_max } : {}),
      };
    }

    const locations = requirement.locations
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (locations && locations.length > 0) {
      where.OR = locations.map((location) => ({
        city: { contains: location, mode: 'insensitive' as const },
      }));
    }

    const shortlisted = new Set(requirement.shortlist.map((row) => row.property_id.toString()));

    const rows = await this.prisma.property.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: query.limit,
    });

    return {
      data: rows.map((row) => ({
        id: row.id.toString(),
        address: row.address,
        city: row.city,
        rooms: row.rooms,
        type: row.type,
        price: Number(row.price),
        listingType: row.listing_type,
        availabilityStatus: row.availability_status,
        shortlisted: shortlisted.has(row.id.toString()),
      })),
      meta: { total: rows.length },
    };
  }

  async shortlistProperty(
    leadId: bigint,
    requirementId: bigint,
    propertyId: bigint,
    actorId: string,
  ) {
    const requirement = await this.prisma.requirement.findFirst({
      where: { id: requirementId, lead_id: leadId },
    });
    if (!requirement) throw new NotFoundException('Requirement not found');

    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new NotFoundException('Property not found');

    await this.prisma.requirementProperty.upsert({
      where: {
        requirement_id_property_id: { requirement_id: requirementId, property_id: propertyId },
      },
      create: {
        requirement_id: requirementId,
        property_id: propertyId,
        added_by: actorId,
      },
      update: {},
    });

    return this.loadRequirement(leadId, requirementId);
  }

  async removeShortlist(leadId: bigint, requirementId: bigint, propertyId: bigint) {
    await this.prisma.requirementProperty.deleteMany({
      where: { requirement_id: requirementId, property_id: propertyId },
    });
    return this.loadRequirement(leadId, requirementId);
  }

  async shortlistedProperties(leadId: bigint, requirementId: bigint) {
    const rows = await this.prisma.requirementProperty.findMany({
      where: { requirement_id: requirementId, requirement: { lead_id: leadId } },
      include: { property: true },
      orderBy: { added_at: 'desc' },
    });

    return rows.map((row) => ({
      id: row.property.id.toString(),
      address: row.property.address,
      city: row.property.city,
      rooms: row.property.rooms,
      price: Number(row.property.price),
      publicationStatus: row.property.publication_status,
      addedAt: row.added_at.toISOString(),
    }));
  }

  // ---------------------------------------------------------------- internals

  private async loadRequirement(leadId: bigint, requirementId: bigint) {
    const requirement = await this.prisma.requirement.findFirstOrThrow({
      where: { id: requirementId, lead_id: leadId },
      include: { shortlist: { select: { property_id: true } } },
    });
    return this.toRequirementDto(requirement, requirement.shortlist.map((row) => row.property_id));
  }

  private assertBudgetRange(min: number | null, max: number | null): void {
    if (min !== null && max !== null && min > max) {
      throw new BadRequestException('Minimum budget cannot be greater than the maximum');
    }
  }

  private async assertAssignableUser(staffId: string): Promise<void> {
    const user = await this.prisma.crmUser.findUnique({ where: { id: staffId } });
    if (!user || !user.active) {
      throw new BadRequestException('Selected staff member is not available');
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

  private async findOneIn(client: Prisma.TransactionClient | PrismaService, id: bigint) {
    const lead = await client.lead.findUnique({ where: { id }, include: LEAD_INCLUDE });
    if (!lead) throw new NotFoundException('Lead not found');

    const staff = await this.staffDirectory([
      lead.assigned_to,
      ...lead.stageHistory.map((row) => row.changed_by),
      ...lead.assignments.map((row) => row.assigned_to),
      ...lead.interactions.map((row) => row.created_by),
    ]);

    return {
      id: lead.id.toString(),
      name: lead.name,
      phone: lead.phone,
      email: lead.email_id,
      location: lead.location,
      address: lead.address,
      message: lead.message,
      propertyType: lead.property_type,
      bedrooms: lead.bedrooms,
      budget: lead.budget,
      stage: lead.stage,
      priority: lead.priority,
      source: lead.source,
      onHoldReason: lead.on_hold_reason,
      assignedTo: lead.assigned_to,
      assignedToName: lead.assigned_to ? (staff.get(lead.assigned_to) ?? null) : null,
      contactId: lead.contact_id?.toString() ?? null,
      contactName: lead.contact?.name ?? null,
      closedAt: lead.closed_at?.toISOString() ?? null,
      closureOutcome: lead.closure_outcome,
      lossReason: lead.loss_reason,
      reopenCount: lead.reopen_count,
      selectedProperty: lead.selected_property
        ? {
            id: lead.selected_property.id.toString(),
            address: lead.selected_property.address,
            city: lead.selected_property.city,
          }
        : null,
      createdAt: lead.created_at.toISOString(),
      updatedAt: lead.updated_at.toISOString(),
      requirements: lead.requirements.map((requirement) =>
        this.toRequirementDto(requirement, requirement.shortlist.map((row) => row.property_id)),
      ),
      interactions: lead.interactions.map((row) => ({
        ...this.toInteractionDto(row),
        createdByName: row.created_by ? (staff.get(row.created_by) ?? null) : null,
      })),
      tasks: lead.tasks.map((task) => ({
        id: task.id.toString(),
        title: task.title,
        dueAt: task.due_at.toISOString(),
        status: task.status,
        assignedTo: task.assigned_to,
        overdue: task.due_at.getTime() < Date.now(),
      })),
      siteVisits: lead.siteVisits.map((visit) => ({
        id: visit.id.toString(),
        propertyId: visit.property_id.toString(),
        scheduledAt: visit.scheduled_at.toISOString(),
        status: visit.status,
        feedback: visit.feedback,
        nextSteps: visit.next_steps,
      })),
      stageHistory: lead.stageHistory.map((row) => ({
        id: row.id.toString(),
        fromStage: row.from_stage,
        toStage: row.to_stage,
        reason: row.reason,
        changedAt: row.changed_at.toISOString(),
        changedBy: row.changed_by ? (staff.get(row.changed_by) ?? null) : null,
      })),
      assignments: lead.assignments.map((row) => ({
        id: row.id.toString(),
        assignedTo: row.assigned_to,
        assignedToName: staff.get(row.assigned_to) ?? null,
        assignedAt: row.assigned_at.toISOString(),
        endedAt: row.ended_at?.toISOString() ?? null,
      })),
    };
  }

  private toInteractionDto(row: {
    id: bigint;
    type: string;
    occurred_at: Date;
    summary: string;
    outcome: string | null;
    next_action: string | null;
  }) {
    return {
      id: row.id.toString(),
      type: row.type,
      occurredAt: row.occurred_at.toISOString(),
      summary: row.summary,
      outcome: row.outcome,
      nextAction: row.next_action,
    };
  }

  private toRequirementDto(
    requirement: {
      id: bigint;
      intent: string;
      budget_min: Prisma.Decimal | null;
      budget_max: Prisma.Decimal | null;
      locations: string | null;
      property_type: string | null;
      bedrooms: string | null;
      timeframe: string | null;
      notes: string | null;
      active: boolean;
      created_at: Date;
    },
    shortlist: bigint[],
  ) {
    return {
      id: requirement.id.toString(),
      intent: requirement.intent,
      budgetMin: requirement.budget_min === null ? null : Number(requirement.budget_min),
      budgetMax: requirement.budget_max === null ? null : Number(requirement.budget_max),
      locations: requirement.locations,
      propertyType: requirement.property_type,
      bedrooms: requirement.bedrooms,
      timeframe: requirement.timeframe,
      notes: requirement.notes,
      active: requirement.active,
      createdAt: requirement.created_at.toISOString(),
      shortlist: shortlist.map((id) => id.toString()),
    };
  }
}
