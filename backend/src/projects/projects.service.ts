import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.module.js';
import { toPropertyDto } from '../properties/property.mapper.js';
import { availabilityStatusSchema, listingTypeSchema } from '../properties/property.schemas.js';

export const listProjectsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
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
  unitCount: number;
  availableCount: number;
}

const INCLUDE = { sale: true, rent: true, project_ref: true } as const;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: z.infer<typeof listProjectsQuerySchema>) {
    const where: Prisma.ProjectWhereInput = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { city: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const skip = (query.page - 1) * query.pageSize;

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: query.pageSize,
      }),
      this.prisma.project.count({ where }),
    ]);

    const ids = projects.map((project) => project.id);

    // Aggregate unit counts in the database rather than per project.
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
        unitCount: unitMap.get(project.id.toString()) ?? 0,
        availableCount: availableMap.get(project.id.toString()) ?? 0,
      })),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      },
    };
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
        include: INCLUDE,
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
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      },
    };
  }
}
