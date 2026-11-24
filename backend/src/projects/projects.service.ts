import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.module.js';
import { toPropertyDto } from '../properties/property.mapper.js';
import {
  availabilityStatusSchema,
  listingTypeSchema,
} from '../properties/property.schemas.js';
import { buildMeta, optionalText } from '../crm/crm.helpers.js';
import { ChangeHistoryService } from '../crm/change-history.service.js';

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(200),
  city: optionalText(120),
  address: optionalText(300),
  externalId: optionalText(120),
  googleLocation: optionalText(300),
  overviewArea: optionalText(120),
  rooms: optionalText(120),
  areaSqft: optionalText(60),
  priceRange: optionalText(120),
  usp: optionalText(2000),
  nearBy: optionalText(2000),
});

export const projectUpdateSchema = projectCreateSchema.partial();

export const listProjectsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  includeArchived: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const inventoryQuerySchema = z.object({
  listingType: listingTypeSchema.optional(),
  availabilityStatus: availabilityStatusSchema.optional(),
  configuration: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export interface ProjectSummaryDto {
  id: string;
  name: string | null;
  city: string | null;
  address: string | null;
  externalId: string | null;
  archived: boolean;
  unitCount: number;
  availableCount: number;
}

const PROPERTY_INCLUDE = { sale: true, rent: true, project_ref: true } as const;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly history: ChangeHistoryService,
  ) {}

  async list(query: z.infer<typeof listProjectsQuerySchema>) {
    const where: Prisma.ProjectWhereInput = {
      ...(query.includeArchived === 'true' ? {} : { archived_at: null }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { city: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const skip = (query.page - 1) * query.pageSize;

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy: [{ archived_at: 'asc' }, { name: 'asc' }],
        skip,
        take: query.pageSize,
      }),
      this.prisma.project.count({ where }),
    ]);

    const ids = projects.map((project) => project.id);

    const [unitCounts, availableCounts] = await Promise.all([
      ids.length
        ? this.prisma.property.groupBy({
            by: ['project_id'],
            where: { project_id: { in: ids } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      ids.length
        ? this.prisma.property.groupBy({
            by: ['project_id'],
            where: {
              project_id: { in: ids },
              availability_status: 'AVAILABLE',
              publication_status: 'PUBLISHED',
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    const unitMap = new Map(unitCounts.map((row) => [row.project_id?.toString(), row._count._all]));
    const availableMap = new Map(
      availableCounts.map((row) => [row.project_id?.toString(), row._count._all]),
    );

    return {
      data: projects.map<ProjectSummaryDto>((project) => ({
        id: project.id.toString(),
        name: project.name,
        city: project.city,
        address: project.address,
        externalId: project.external_id,
        archived: project.archived_at !== null,
        unitCount: unitMap.get(project.id.toString()) ?? 0,
        availableCount: availableMap.get(project.id.toString()) ?? 0,
      })),
      meta: buildMeta(query.page, query.pageSize, total),
    };
  }

  async findOne(id: bigint) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');

    const [byAvailability, byConfiguration, byListingType, visits] = await Promise.all([
      this.prisma.property.groupBy({
        by: ['availability_status'],
        where: { project_id: id },
        _count: { _all: true },
      }),
      this.prisma.property.groupBy({
        by: ['rooms'],
        where: { project_id: id },
        _count: { _all: true },
      }),
      this.prisma.property.groupBy({
        by: ['listing_type'],
        where: { project_id: id },
        _count: { _all: true },
      }),
      this.prisma.siteVisit.count({ where: { property: { project_id: id } } }),
    ]);

    return {
      id: project.id.toString(),
      name: project.name,
      city: project.city,
      address: project.address,
      externalId: project.external_id,
      googleLocation: project.google_location,
      overviewArea: project.overview_area,
      rooms: project.rooms,
      areaSqft: project.area_sqft,
      priceRange: project.price_range,
      usp: project.usp,
      nearBy: project.near_by,
      archived: project.archived_at !== null,
      archivedAt: project.archived_at?.toISOString() ?? null,
      createdAt: project.created_at.toISOString(),
      summary: {
        unitCount: byAvailability.reduce((sum, row) => sum + row._count._all, 0),
        byAvailability: byAvailability.map((row) => ({
          availabilityStatus: row.availability_status,
          count: row._count._all,
        })),
        byConfiguration: byConfiguration.map((row) => ({
          configuration: row.rooms,
          count: row._count._all,
        })),
        byListingType: byListingType.map((row) => ({
          listingType: row.listing_type,
          count: row._count._all,
        })),
        siteVisits: visits,
      },
    };
  }

  async create(input: z.infer<typeof projectCreateSchema>, actorId: string) {
    const project = await this.prisma.project.create({
      data: {
        name: input.name,
        city: input.city ?? null,
        address: input.address ?? null,
        external_id: input.externalId ?? null,
        google_location: input.googleLocation ?? null,
        overview_area: input.overviewArea ?? null,
        rooms: input.rooms ?? null,
        area_sqft: input.areaSqft ?? null,
        price_range: input.priceRange ?? null,
        usp: input.usp ?? null,
        near_by: input.nearBy ?? null,
      },
    });

    await this.history.record({
      entityType: 'project',
      entityId: project.id.toString(),
      action: 'created',
      summary: `Project "${input.name}" created`,
      actorId,
    });

    return this.findOne(project.id);
  }

  async update(id: bigint, input: z.infer<typeof projectUpdateSchema>, actorId: string) {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Project not found');
    if (existing.archived_at) {
      throw new ConflictException('Archived projects cannot be edited. Restore it first.');
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.externalId !== undefined ? { external_id: input.externalId } : {}),
        ...(input.googleLocation !== undefined ? { google_location: input.googleLocation } : {}),
        ...(input.overviewArea !== undefined ? { overview_area: input.overviewArea } : {}),
        ...(input.rooms !== undefined ? { rooms: input.rooms } : {}),
        ...(input.areaSqft !== undefined ? { area_sqft: input.areaSqft } : {}),
        ...(input.priceRange !== undefined ? { price_range: input.priceRange } : {}),
        ...(input.usp !== undefined ? { usp: input.usp } : {}),
        ...(input.nearBy !== undefined ? { near_by: input.nearBy } : {}),
      },
    });

    await this.history.record({
      entityType: 'project',
      entityId: id.toString(),
      action: 'updated',
      summary: `Project "${updated.name ?? id}" updated`,
      changes: input as Record<string, unknown>,
      actorId,
    });

    return this.findOne(id);
  }

  async archive(id: bigint, actorId: string) {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Project not found');
    if (existing.archived_at) throw new ConflictException('Project is already archived');

    await this.prisma.project.update({ where: { id }, data: { archived_at: new Date() } });

    await this.history.record({
      entityType: 'project',
      entityId: id.toString(),
      action: 'archived',
      summary: `Project "${existing.name ?? id}" archived. Records are preserved.`,
      actorId,
    });

    return this.findOne(id);
  }

  async restore(id: bigint, actorId: string) {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Project not found');
    if (!existing.archived_at) throw new ConflictException('Project is not archived');

    await this.prisma.project.update({ where: { id }, data: { archived_at: null } });

    await this.history.record({
      entityType: 'project',
      entityId: id.toString(),
      action: 'restored',
      summary: `Project "${existing.name ?? id}" restored`,
      actorId,
    });

    return this.findOne(id);
  }

  async inventory(projectId: bigint, query: z.infer<typeof inventoryQuerySchema>) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const baseWhere: Prisma.PropertyWhereInput = { project_id: projectId };
    if (query.listingType) baseWhere.listing_type = query.listingType;
    if (query.availabilityStatus) baseWhere.availability_status = query.availabilityStatus;
    if (query.configuration) {
      baseWhere.rooms = { equals: query.configuration, mode: 'insensitive' };
    }

    const skip = (query.page - 1) * query.pageSize;

    const [units, total, byAvailability, byConfiguration] = await Promise.all([
      this.prisma.property.findMany({
        where: baseWhere,
        include: PROPERTY_INCLUDE,
        orderBy: [{ unit_identifier: 'asc' }, { id: 'asc' }],
        skip,
        take: query.pageSize,
      }),
      this.prisma.property.count({ where: baseWhere }),
      this.prisma.property.groupBy({
        by: ['availability_status'],
        where: { project_id: projectId },
        _count: { _all: true },
      }),
      this.prisma.property.groupBy({
        by: ['rooms'],
        where: { project_id: projectId },
        _count: { _all: true },
      }),
    ]);

    return {
      project: {
        id: project.id.toString(),
        name: project.name,
        city: project.city,
        address: project.address,
        externalId: project.external_id,
        archived: project.archived_at !== null,
      },
      summary: {
        unitCount: byAvailability.reduce((sum, row) => sum + row._count._all, 0),
        byAvailability: byAvailability.map((row) => ({
          availabilityStatus: row.availability_status,
          count: row._count._all,
        })),
        byConfiguration: byConfiguration.map((row) => ({
          configuration: row.rooms,
          count: row._count._all,
        })),
      },
      units: units.map(toPropertyDto),
      meta: buildMeta(query.page, query.pageSize, total),
    };
  }

  async options() {
    const projects = await this.prisma.project.findMany({
      where: { archived_at: null },
      orderBy: { name: 'asc' },
      take: 500,
      select: { id: true, name: true, city: true },
    });
    return projects.map((project) => ({
      id: project.id.toString(),
      name: project.name,
      city: project.city,
    }));
  }
}
