import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module.js';
import { toPropertyDto, type PropertyDto, type PropertyWithRelations } from './property.mapper.js';
import type {
  AvailabilityStatusInput,
  CreatePropertyInput,
  ListPropertiesQuery,
  PublicListQuery,
  UpdatePropertyInput,
} from './property.schemas.js';

const INCLUDE = { sale: true, rent: true, project_ref: true } as const;

/** Legacy free-text values the public website filters on. */
const LEGACY_LISTING_VALUE: Record<'SALE' | 'RENT', string> = {
  SALE: 'buy',
  RENT: 'rent',
};

const RENT_ONLY_FIELDS = ['depositAmount', 'maintenanceAmount', 'furnishing'] as const;
const SALE_ONLY_FIELDS = ['priceNegotiable', 'ownershipType'] as const;

export interface PaginatedResult<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreatePropertyInput): Promise<PropertyDto> {
    this.assertSubtypeFieldCoherence(input.listingType, input);

    return this.prisma.$transaction(async (tx) => {
      const projectName = await this.resolveProjectName(tx, input.projectId ?? null);

      const created = await tx.property.create({
        data: {
          listing: LEGACY_LISTING_VALUE[input.listingType],
          listing_type: input.listingType,
          publication_status: 'DRAFT',
          availability_status: 'AVAILABLE',
          city: input.city,
          address: input.address,
          rooms: input.rooms,
          price: new Prisma.Decimal(input.price),
          type: input.type ?? null,
          pin_code: input.pinCode ?? null,
          bathrooms: input.bathrooms ?? null,
          parking: input.parking ?? null,
          area: input.area === null || input.area === undefined ? null : BigInt(input.area),
          facing: input.facing ?? null,
          starting_dt: input.availableFrom ? new Date(`${input.availableFrom}T00:00:00.000Z`) : null,
          message: input.description ?? null,
          unit_identifier: input.unitIdentifier ?? null,
          project_id: input.projectId ?? null,
          project: projectName,
        },
      });

      // The subtype is created with the property, not at publication.
      if (input.listingType === 'SALE') {
        await tx.saleProperty.create({
          data: {
            property_id: created.id,
            price_negotiable: input.priceNegotiable ?? null,
            ownership_type: input.ownershipType ?? null,
          },
        });
      } else {
        await tx.rentProperty.create({
          data: {
            property_id: created.id,
            deposit_amount:
              input.depositAmount === null || input.depositAmount === undefined
                ? null
                : new Prisma.Decimal(input.depositAmount),
            maintenance_amount:
              input.maintenanceAmount === null || input.maintenanceAmount === undefined
                ? null
                : new Prisma.Decimal(input.maintenanceAmount),
            furnishing: input.furnishing ?? null,
          },
        });
      }

      const loaded = await tx.property.findUniqueOrThrow({
        where: { id: created.id },
        include: INCLUDE,
      });
      return toPropertyDto(loaded);
    });
  }

  async findOne(id: bigint): Promise<PropertyDto> {
    const property = await this.prisma.property.findUnique({ where: { id }, include: INCLUDE });
    if (!property) throw new NotFoundException('Property not found');
    return toPropertyDto(property);
  }

  async list(query: ListPropertiesQuery): Promise<PaginatedResult<PropertyDto>> {
    const where = this.buildWhere(query);
    const skip = (query.page - 1) * query.pageSize;

    const [rows, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        include: INCLUDE,
        orderBy: this.buildOrderBy(query.sort),
        skip,
        take: query.pageSize,
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      data: rows.map(toPropertyDto),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      },
    };
  }

  async update(id: bigint, input: UpdatePropertyInput): Promise<PropertyDto> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockProperty(tx, id);
      const existing = await tx.property.findUnique({ where: { id }, include: INCLUDE });
      if (!existing) throw new NotFoundException('Property not found');

      if (existing.publication_status === 'ARCHIVED') {
        throw new ConflictException('Archived properties cannot be edited. Restore it first.');
      }

      this.assertOptimisticConcurrency(existing, input.expectedUpdatedAt);

      if (existing.listing_type) {
        this.assertSubtypeFieldCoherence(existing.listing_type, input);
      }

      const projectIdProvided = Object.prototype.hasOwnProperty.call(input, 'projectId');
      const projectName = projectIdProvided
        ? await this.resolveProjectName(tx, input.projectId ?? null)
        : undefined;

      const data: Prisma.PropertyUncheckedUpdateInput = {};
      if (input.city !== undefined) data.city = input.city;
      if (input.address !== undefined) data.address = input.address;
      if (input.rooms !== undefined) data.rooms = input.rooms;
      if (input.price !== undefined) data.price = new Prisma.Decimal(input.price);
      if (input.type !== undefined) data.type = input.type;
      if (input.pinCode !== undefined) data.pin_code = input.pinCode;
      if (input.bathrooms !== undefined) data.bathrooms = input.bathrooms;
      if (input.parking !== undefined) data.parking = input.parking;
      if (input.area !== undefined) data.area = input.area === null ? null : BigInt(input.area);
      if (input.facing !== undefined) data.facing = input.facing;
      if (input.availableFrom !== undefined) {
        data.starting_dt = input.availableFrom
          ? new Date(`${input.availableFrom}T00:00:00.000Z`)
          : null;
      }
      if (input.description !== undefined) data.message = input.description;
      if (input.unitIdentifier !== undefined) data.unit_identifier = input.unitIdentifier;
      if (projectIdProvided) {
        data.project_id = input.projectId ?? null;
        data.project = projectName ?? null;
      }

      if (Object.keys(data).length > 0) {
        await tx.property.update({ where: { id }, data });
      }

      await this.updateSubtype(tx, id, existing.listing_type, input);

      const reloaded = await tx.property.findUniqueOrThrow({ where: { id }, include: INCLUDE });
      return toPropertyDto(reloaded);
    });
  }

  async publish(id: bigint): Promise<PropertyDto> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockProperty(tx, id);
      const property = await tx.property.findUnique({ where: { id }, include: INCLUDE });
      if (!property) throw new NotFoundException('Property not found');

      if (property.publication_status === 'ARCHIVED') {
        throw new ConflictException('An archived property cannot be published. Restore it first.');
      }
      if (property.publication_status === 'PUBLISHED') {
        throw new ConflictException('Property is already published');
      }
      if (!property.listing_type) {
        throw new ConflictException('Property has no listing type and cannot be published');
      }

      this.assertSubtypeIntegrity(property);

      const missing = this.missingForPublication(property);
      if (missing.length > 0) {
        throw new BadRequestException({
          message: 'Property is not ready to publish',
          missing,
        });
      }

      const updated = await tx.property.update({
        where: { id },
        data: { publication_status: 'PUBLISHED', published_at: new Date() },
        include: INCLUDE,
      });
      return toPropertyDto(updated);
    });
  }

  async unpublish(id: bigint): Promise<PropertyDto> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockProperty(tx, id);
      const property = await tx.property.findUnique({ where: { id }, include: INCLUDE });
      if (!property) throw new NotFoundException('Property not found');

      if (property.publication_status !== 'PUBLISHED') {
        throw new ConflictException('Only a published property can be unpublished');
      }

      const updated = await tx.property.update({
        where: { id },
        data: { publication_status: 'UNPUBLISHED' },
        include: INCLUDE,
      });
      return toPropertyDto(updated);
    });
  }

  async archive(id: bigint, actorId: string, reason?: string): Promise<PropertyDto> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockProperty(tx, id);
      const property = await tx.property.findUnique({ where: { id }, include: INCLUDE });
      if (!property) throw new NotFoundException('Property not found');

      if (property.publication_status === 'ARCHIVED') {
        throw new ConflictException('Property is already archived');
      }

      const snapshot = toPropertyDto(property) as unknown as Prisma.InputJsonValue;

      await tx.propertyArchive.create({
        data: {
          property_id: id,
          listing_type: property.listing_type,
          previous_status: property.publication_status,
          previous_availability: property.availability_status,
          snapshot,
          reason: reason?.trim() ? reason.trim() : null,
          archived_by: actorId,
        },
      });

      const updated = await tx.property.update({
        where: { id },
        data: { publication_status: 'ARCHIVED' },
        include: INCLUDE,
      });
      return toPropertyDto(updated);
    });
  }

  async restore(id: bigint): Promise<PropertyDto> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockProperty(tx, id);
      const property = await tx.property.findUnique({ where: { id }, include: INCLUDE });
      if (!property) throw new NotFoundException('Property not found');

      if (property.publication_status !== 'ARCHIVED') {
        throw new ConflictException('Only an archived property can be restored');
      }

      const lastEvent = await tx.propertyArchive.findFirst({
        where: { property_id: id },
        orderBy: { archived_at: 'desc' },
      });

      const previous = lastEvent?.previous_status ?? 'DRAFT';
      const target = previous === 'ARCHIVED' ? 'DRAFT' : previous;

      const updated = await tx.property.update({
        where: { id },
        data: { publication_status: target },
        include: INCLUDE,
      });
      return toPropertyDto(updated);
    });
  }

  async setAvailability(id: bigint, availability: AvailabilityStatusInput): Promise<PropertyDto> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockProperty(tx, id);
      const property = await tx.property.findUnique({ where: { id }, include: INCLUDE });
      if (!property) throw new NotFoundException('Property not found');

      if (property.publication_status === 'ARCHIVED') {
        throw new ConflictException('Archived properties cannot change availability. Restore it first.');
      }
      if (availability === 'SOLD' && property.listing_type !== 'SALE') {
        throw new BadRequestException('Only a sale property can be marked as sold');
      }
      if (availability === 'RENTED' && property.listing_type !== 'RENT') {
        throw new BadRequestException('Only a rental property can be marked as rented');
      }

      const updated = await tx.property.update({
        where: { id },
        data: { availability_status: availability },
        include: INCLUDE,
      });
      return toPropertyDto(updated);
    });
  }

  async listPublic(query: PublicListQuery): Promise<PaginatedResult<PropertyDto>> {
    const skip = (query.page - 1) * query.pageSize;

    const where: Prisma.PropertyWhereInput = {
      publication_status: 'PUBLISHED',
      // Sold and rented listings stay reachable by direct link but drop out of
      // active search results.
      availability_status: { in: ['AVAILABLE', 'ON_HOLD'] },
    };

    if (query.listingType) where.listing_type = query.listingType;
    if (query.city) where.city = { equals: query.city, mode: 'insensitive' };
    if (query.projectId) where.project_id = BigInt(query.projectId);
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {
        ...(query.minPrice !== undefined ? { gte: new Prisma.Decimal(query.minPrice) } : {}),
        ...(query.maxPrice !== undefined ? { lte: new Prisma.Decimal(query.maxPrice) } : {}),
      };
    }
    if (query.search) {
      const term = query.search;
      where.OR = [
        { address: { contains: term, mode: 'insensitive' } },
        { city: { contains: term, mode: 'insensitive' } },
        { project: { contains: term, mode: 'insensitive' } },
        { unit_identifier: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        include: INCLUDE,
        orderBy: { created_at: 'desc' },
        skip,
        take: query.pageSize,
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      data: rows.map(toPropertyDto),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      },
    };
  }

  async findOnePublic(id: bigint): Promise<PropertyDto> {
    const property = await this.prisma.property.findUnique({ where: { id }, include: INCLUDE });
    if (!property || property.publication_status !== 'PUBLISHED') {
      throw new NotFoundException('Property not found');
    }
    return toPropertyDto(property);
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private buildWhere(query: ListPropertiesQuery): Prisma.PropertyWhereInput {
    const where: Prisma.PropertyWhereInput = {};
    if (query.publicationStatus) where.publication_status = query.publicationStatus;
    if (query.listingType) where.listing_type = query.listingType;
    if (query.availabilityStatus) where.availability_status = query.availabilityStatus;
    if (query.projectId) where.project_id = BigInt(query.projectId);

    if (query.search) {
      const term = query.search;
      where.OR = [
        { address: { contains: term, mode: 'insensitive' } },
        { city: { contains: term, mode: 'insensitive' } },
        { unit_identifier: { contains: term, mode: 'insensitive' } },
        { message: { contains: term, mode: 'insensitive' } },
        { project: { contains: term, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private buildOrderBy(
    sort: ListPropertiesQuery['sort'],
  ): Prisma.PropertyOrderByWithRelationInput {
    switch (sort) {
      case 'updatedAt:asc':
        return { updated_at: 'asc' };
      case 'createdAt:desc':
        return { created_at: 'desc' };
      case 'price:asc':
        return { price: 'asc' };
      case 'price:desc':
        return { price: 'desc' };
      case 'updatedAt:desc':
      default:
        return { updated_at: 'desc' };
    }
  }

  private async lockProperty(tx: Prisma.TransactionClient, id: bigint): Promise<void> {
    await tx.$queryRaw`SELECT "id" FROM "property" WHERE "id" = ${id} FOR UPDATE`;
  }

  private async resolveProjectName(
    tx: Prisma.TransactionClient,
    projectId: number | null,
  ): Promise<string | null> {
    if (projectId === null || projectId === undefined) return null;
    const project = await tx.project.findUnique({
      where: { id: BigInt(projectId) },
      select: { name: true },
    });
    if (!project) throw new BadRequestException('Selected project does not exist');
    return project.name ?? null;
  }

  private assertSubtypeFieldCoherence(
    listingType: 'SALE' | 'RENT',
    input: CreatePropertyInput | UpdatePropertyInput,
  ): void {
    const record = input as Record<string, unknown>;
    const forbidden =
      listingType === 'SALE'
        ? RENT_ONLY_FIELDS.filter((field) => record[field] !== undefined && record[field] !== null)
        : SALE_ONLY_FIELDS.filter((field) => record[field] !== undefined && record[field] !== null);

    if (forbidden.length > 0) {
      const kind = listingType === 'SALE' ? 'rental' : 'sale';
      throw new BadRequestException(
        `${kind} fields cannot be used on a ${listingType.toLowerCase()} property: ${forbidden.join(', ')}`,
      );
    }
  }

  private assertSubtypeIntegrity(property: PropertyWithRelations): void {
    const hasSale = property.sale !== null;
    const hasRent = property.rent !== null;

    if (hasSale && hasRent) {
      throw new ConflictException('Property has both a sale and a rental record');
    }
    if (property.listing_type === 'SALE' && !hasSale) {
      throw new ConflictException('Sale record is missing for this property');
    }
    if (property.listing_type === 'RENT' && !hasRent) {
      throw new ConflictException('Rent record is missing for this property');
    }
  }

  private missingForPublication(property: PropertyWithRelations): string[] {
    const missing: string[] = [];
    if (!property.city?.trim()) missing.push('City');
    if (!property.address?.trim()) missing.push('Address');
    if (!property.rooms?.trim()) missing.push('Configuration');
    if (property.price === null || Number(property.price) <= 0) missing.push('Price');
    return missing;
  }

  private assertOptimisticConcurrency(
    property: PropertyWithRelations,
    expectedUpdatedAt: string | undefined,
  ): void {
    if (!expectedUpdatedAt) return;
    const expected = new Date(expectedUpdatedAt).getTime();
    if (Number.isNaN(expected)) {
      throw new BadRequestException('expectedUpdatedAt is not a valid timestamp');
    }
    if (expected !== property.updated_at.getTime()) {
      throw new ConflictException(
        'This property was changed by someone else. Reload it and try again.',
      );
    }
  }

  private async updateSubtype(
    tx: Prisma.TransactionClient,
    propertyId: bigint,
    listingType: 'SALE' | 'RENT' | null,
    input: UpdatePropertyInput,
  ): Promise<void> {
    if (!listingType) return;

    if (listingType === 'SALE') {
      const data: Prisma.SalePropertyUpdateInput = {};
      if (input.priceNegotiable !== undefined) data.price_negotiable = input.priceNegotiable;
      if (input.ownershipType !== undefined) data.ownership_type = input.ownershipType;
      if (Object.keys(data).length > 0) {
        await tx.saleProperty.update({ where: { property_id: propertyId }, data });
      }
      return;
    }

    const data: Prisma.RentPropertyUpdateInput = {};
    if (input.depositAmount !== undefined) {
      data.deposit_amount =
        input.depositAmount === null ? null : new Prisma.Decimal(input.depositAmount);
    }
    if (input.maintenanceAmount !== undefined) {
      data.maintenance_amount =
        input.maintenanceAmount === null ? null : new Prisma.Decimal(input.maintenanceAmount);
    }
    if (input.furnishing !== undefined) data.furnishing = input.furnishing;
    if (Object.keys(data).length > 0) {
      await tx.rentProperty.update({ where: { property_id: propertyId }, data });
    }
  }
}
