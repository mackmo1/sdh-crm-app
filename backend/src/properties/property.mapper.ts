import type { Prisma } from '@prisma/client';

export type PropertyWithRelations = Prisma.PropertyGetPayload<{
  include: { sale: true; rent: true; project_ref: true };
}>;

export interface PropertyDto {
  id: string;
  listingType: 'SALE' | 'RENT' | null;
  publicationStatus: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED';
  availabilityStatus: 'AVAILABLE' | 'ON_HOLD' | 'SOLD' | 'RENTED';
  unitIdentifier: string | null;
  projectId: string | null;
  projectName: string | null;
  type: string | null;
  city: string;
  address: string;
  pinCode: string | null;
  rooms: string;
  bathrooms: number | null;
  parking: boolean | null;
  area: number | null;
  price: number;
  facing: string | null;
  availableFrom: string | null;
  description: string | null;
  sale: { priceNegotiable: boolean | null; ownershipType: string | null } | null;
  rent: {
    depositAmount: number | null;
    maintenanceAmount: number | null;
    furnishing: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

function toDateOnly(value: Date | null): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function toNumberOrNull(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

export function toPropertyDto(property: PropertyWithRelations): PropertyDto {
  return {
    id: property.id.toString(),
    listingType: property.listing_type,
    publicationStatus: property.publication_status,
    availabilityStatus: property.availability_status,
    unitIdentifier: property.unit_identifier,
    projectId: property.project_id === null ? null : property.project_id.toString(),
    projectName: property.project_ref?.name ?? property.project ?? null,
    type: property.type,
    city: property.city,
    address: property.address,
    pinCode: property.pin_code,
    rooms: property.rooms,
    bathrooms: property.bathrooms,
    parking: property.parking,
    area: property.area === null ? null : Number(property.area),
    price: Number(property.price),
    facing: property.facing,
    availableFrom: toDateOnly(property.starting_dt),
    description: property.message,
    sale: property.sale
      ? {
          priceNegotiable: property.sale.price_negotiable,
          ownershipType: property.sale.ownership_type,
        }
      : null,
    rent: property.rent
      ? {
          depositAmount: toNumberOrNull(property.rent.deposit_amount),
          maintenanceAmount: toNumberOrNull(property.rent.maintenance_amount),
          furnishing: property.rent.furnishing,
        }
      : null,
    createdAt: property.created_at.toISOString(),
    updatedAt: property.updated_at.toISOString(),
    publishedAt: property.published_at?.toISOString() ?? null,
  };
}
