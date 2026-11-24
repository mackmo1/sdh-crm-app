import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.module.js';
import { ChangeHistoryService } from './change-history.service.js';

export type ImportEntity = 'properties' | 'projects' | 'contacts' | 'leads';

const ENTITIES: ImportEntity[] = ['properties', 'projects', 'contacts', 'leads'];

export function isImportEntity(value: string): value is ImportEntity {
  return ENTITIES.includes(value as ImportEntity);
}

export const importPreviewSchema = z.object({
  csv: z.string().min(1, 'Upload a CSV file').max(5_000_000),
});

export const importCommitSchema = z.object({
  csv: z.string().min(1, 'Upload a CSV file').max(5_000_000),
  excludeRows: z.array(z.coerce.number().int().min(0)).max(5000).default([]),
});

/* ----------------------------------------------------------------- CSV I/O */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((value) => value.trim() !== ''));
}

type CellValue = string | number | boolean | bigint | null | undefined;

function escapeCell(value: CellValue): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: CellValue[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

/* ---------------------------------------------------------------- service */

export interface RowIssue {
  index: number;
  values: Record<string, string>;
  errors: string[];
  duplicateOf: string | null;
}

@Injectable()
export class DataTransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly history: ChangeHistoryService,
  ) {}

  // ------------------------------------------------------------- exports

  async exportCsv(entity: ImportEntity): Promise<{ filename: string; csv: string }> {
    switch (entity) {
      case 'properties':
        return this.exportProperties();
      case 'projects':
        return this.exportProjects();
      case 'contacts':
        return this.exportContacts();
      case 'leads':
        return this.exportLeads();
    }
  }

  private async exportProperties() {
    const rows = await this.prisma.property.findMany({
      orderBy: { id: 'asc' },
      include: { project_ref: { select: { name: true } } },
    });

    const headers = [
      'id',
      'listing_type',
      'publication_status',
      'availability_status',
      'city',
      'address',
      'pin_code',
      'rooms',
      'bathrooms',
      'parking',
      'area',
      'price',
      'facing',
      'available_from',
      'type',
      'project',
      'unit_identifier',
      'description',
      'created_at',
    ];

    const data = rows.map((row) => [
      row.id.toString(),
      row.listing_type ?? '',
      row.publication_status,
      row.availability_status,
      row.city,
      row.address,
      row.pin_code,
      row.rooms,
      row.bathrooms,
      row.parking,
      row.area?.toString() ?? '',
      Number(row.price),
      row.facing,
      row.starting_dt ? row.starting_dt.toISOString().slice(0, 10) : '',
      row.type,
      row.project_ref?.name ?? row.project,
      row.unit_identifier,
      row.message,
      row.created_at.toISOString(),
    ]);

    return { filename: 'properties.csv', csv: toCsv(headers, data) };
  }

  private async exportProjects() {
    const rows = await this.prisma.project.findMany({ orderBy: { id: 'asc' } });
    const headers = [
      'id',
      'name',
      'city',
      'address',
      'external_id',
      'rooms',
      'area_sqft',
      'price_range',
      'archived',
      'created_at',
    ];
    const data = rows.map((row) => [
      row.id.toString(),
      row.name,
      row.city,
      row.address,
      row.external_id,
      row.rooms,
      row.area_sqft,
      row.price_range,
      row.archived_at ? 'yes' : 'no',
      row.created_at.toISOString(),
    ]);
    return { filename: 'projects.csv', csv: toCsv(headers, data) };
  }

  private async exportContacts() {
    const rows = await this.prisma.contact.findMany({ orderBy: { id: 'asc' } });
    const headers = ['id', 'name', 'category', 'phone', 'email', 'company', 'city', 'active', 'created_at'];
    const data = rows.map((row) => [
      row.id.toString(),
      row.name,
      row.category,
      row.phone,
      row.email,
      row.company,
      row.city,
      row.active ? 'yes' : 'no',
      row.created_at.toISOString(),
    ]);
    return { filename: 'contacts.csv', csv: toCsv(headers, data) };
  }

  private async exportLeads() {
    const rows = await this.prisma.lead.findMany({
      orderBy: { id: 'asc' },
      include: { contact: { select: { name: true } } },
    });
    const headers = [
      'id',
      'name',
      'phone',
      'email',
      'location',
      'stage',
      'priority',
      'source',
      'assigned_to',
      'contact',
      'budget',
      'created_at',
    ];
    const data = rows.map((row) => [
      row.id.toString(),
      row.name,
      row.phone,
      row.email_id,
      row.location,
      row.stage,
      row.priority,
      row.source,
      row.assigned_to,
      row.contact?.name ?? '',
      row.budget,
      row.created_at.toISOString(),
    ]);
    return { filename: 'leads.csv', csv: toCsv(headers, data) };
  }

  // ------------------------------------------------------------- previews

  async preview(entity: ImportEntity, csv: string) {
    const parsed = parseCsv(csv);
    if (parsed.length < 2) {
      throw new BadRequestException('The file needs a header row and at least one data row');
    }

    const headers = parsed[0].map((header) => header.trim().toLowerCase());
    const rows = parsed.slice(1);

    const issues: RowIssue[] = [];
    const valid: { index: number; values: Record<string, string> }[] = [];

    for (let index = 0; index < rows.length; index += 1) {
      const values: Record<string, string> = {};
      headers.forEach((header, column) => {
        values[header] = (rows[index][column] ?? '').trim();
      });

      const errors = this.validateRow(entity, values);
      const duplicateOf = errors.length === 0 ? await this.findDuplicate(entity, values) : null;

      if (errors.length > 0) {
        issues.push({ index: index + 2, values, errors, duplicateOf: null });
      } else {
        if (duplicateOf) issues.push({ index: index + 2, values, errors: [], duplicateOf });
        valid.push({ index: index + 2, values });
      }
    }

    return {
      entity,
      headers,
      totalRows: rows.length,
      validRows: valid.filter(
        (row) => !issues.some((issue) => issue.index === row.index && issue.duplicateOf),
      ).length,
      duplicateRows: issues.filter((issue) => issue.duplicateOf).length,
      invalidRows: issues.filter((issue) => issue.errors.length > 0).length,
      issues,
      preview: valid.slice(0, 20).map((row) => ({ index: row.index, ...row.values })),
    };
  }

  async commit(entity: ImportEntity, csv: string, excludeRows: number[], actorId: string) {
    const parsed = parseCsv(csv);
    const headers = parsed[0].map((header) => header.trim().toLowerCase());
    const rows = parsed.slice(1);
    const excluded = new Set(excludeRows);

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2;
      const values: Record<string, string> = {};
      headers.forEach((header, column) => {
        values[header] = (rows[index][column] ?? '').trim();
      });

      if (excluded.has(index) || excluded.has(rowNumber)) {
        skipped += 1;
        continue;
      }

      const errors = this.validateRow(entity, values);
      if (errors.length > 0) {
        failed += 1;
        continue;
      }

      // Rows that duplicate existing records are never inserted silently; they
      // are reported as skipped so the user can review them.
      if (await this.findDuplicate(entity, values)) {
        skipped += 1;
        continue;
      }

      try {
        await this.insertRow(entity, values, actorId);
        imported += 1;
      } catch {
        failed += 1;
      }
    }

    await this.prisma.importRun.create({
      data: { entity_type: entity, imported, skipped, failed, actor_id: actorId },
    });
    await this.history.record({
      entityType: 'import',
      entityId: entity,
      action: 'imported',
      summary: `Imported ${imported} ${entity} (skipped ${skipped}, failed ${failed})`,
      actorId,
    });

    return { imported, skipped, failed };
  }

  // -------------------------------------------------------------- internals

  private validateRow(entity: ImportEntity, values: Record<string, string>): string[] {
    const errors: string[] = [];

    const required = (field: string, label: string) => {
      if (!values[field]) errors.push(`${label} is required`);
    };

    if (entity === 'contacts') {
      required('name', 'Name');
      const category = (values.category || '').toUpperCase();
      if (!['BUYER', 'SELLER', 'LANDLORD', 'TENANT', 'BUILDER'].includes(category)) {
        errors.push('Category must be one of buyer, seller, landlord, tenant, builder');
      }
      if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
        errors.push('Email is not valid');
      }
    }

    if (entity === 'leads') {
      required('name', 'Name');
      required('phone', 'Phone');
      required('email', 'Email');
      required('location', 'Location');
      if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
        errors.push('Email is not valid');
      }
    }

    if (entity === 'projects') {
      required('name', 'Name');
    }

    if (entity === 'properties') {
      required('address', 'Address');
      required('city', 'City');
      required('rooms', 'Configuration');
      const listingType = (values.listing_type || '').toUpperCase();
      if (!['SALE', 'RENT'].includes(listingType)) errors.push('listing_type must be SALE or RENT');
      const price = Number(values.price);
      if (!Number.isFinite(price) || price < 0) errors.push('Price must be a positive number');
    }

    return errors;
  }

  private async findDuplicate(entity: ImportEntity, values: Record<string, string>): Promise<string | null> {
    if (entity === 'contacts') {
      const match = await this.prisma.contact.findFirst({
        where: {
          OR: [
            ...(values.phone ? [{ phone: values.phone }] : []),
            ...(values.email ? [{ email: values.email }] : []),
          ],
        },
      });
      return match ? `Existing contact "${match.name}" (#${match.id})` : null;
    }

    if (entity === 'leads') {
      const match = await this.prisma.lead.findFirst({ where: { phone: values.phone } });
      return match ? `Existing lead #${match.id}` : null;
    }

    if (entity === 'projects') {
      const match = await this.prisma.project.findFirst({
        where: { name: { equals: values.name, mode: 'insensitive' } },
      });
      return match ? `Existing project #${match.id}` : null;
    }

    const match = await this.prisma.property.findFirst({
      where: { address: values.address, city: values.city },
    });
    return match ? `Existing property #${match.id}` : null;
  }

  private async insertRow(entity: ImportEntity, values: Record<string, string>, actorId: string) {
    if (entity === 'contacts') {
      await this.prisma.contact.create({
        data: {
          name: values.name,
          category: (values.category || 'BUYER').toUpperCase() as Prisma.ContactCreateInput['category'],
          phone: values.phone || null,
          email: values.email || null,
          company: values.company || null,
          city: values.city || null,
          notes: values.notes || null,
          created_by: actorId,
        },
      });
      return;
    }

    if (entity === 'leads') {
      await this.prisma.lead.create({
        data: {
          name: values.name,
          phone: values.phone,
          email_id: values.email,
          location: values.location,
          who: values.who || 'buyer',
          intent: values.intent || 'buy',
          source: values.source || 'import',
          budget: values.budget || null,
          status: 'new',
        },
      });
      return;
    }

    if (entity === 'projects') {
      await this.prisma.project.create({
        data: {
          name: values.name,
          city: values.city || null,
          address: values.address || null,
          external_id: values.external_id || null,
          rooms: values.rooms || null,
          area_sqft: values.area_sqft || null,
          price_range: values.price_range || null,
        },
      });
      return;
    }

    const listingType = (values.listing_type || 'SALE').toUpperCase() as 'SALE' | 'RENT';

    await this.prisma.$transaction(async (tx) => {
      const created = await tx.property.create({
        data: {
          listing: listingType === 'SALE' ? 'buy' : 'rent',
          listing_type: listingType,
          publication_status: 'DRAFT',
          availability_status: 'AVAILABLE',
          city: values.city,
          address: values.address,
          rooms: values.rooms,
          price: new Prisma.Decimal(Number(values.price)),
          type: values.type || null,
          pin_code: values.pin_code || null,
          facing: values.facing || null,
          message: values.description || null,
          unit_identifier: values.unit_identifier || null,
        },
      });

      if (listingType === 'SALE') {
        await tx.saleProperty.create({ data: { property_id: created.id } });
      } else {
        await tx.rentProperty.create({ data: { property_id: created.id } });
      }
    });
  }
}
