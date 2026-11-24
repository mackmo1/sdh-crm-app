import { z } from 'zod';

export const listingTypeSchema = z.enum(['SALE', 'RENT']);
export const publicationStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED']);
export const availabilityStatusSchema = z.enum(['AVAILABLE', 'ON_HOLD', 'SOLD', 'RENTED']);

export type ListingTypeInput = z.infer<typeof listingTypeSchema>;
export type PublicationStatusInput = z.infer<typeof publicationStatusSchema>;
export type AvailabilityStatusInput = z.infer<typeof availabilityStatusSchema>;

/** Treats an empty form field as "not provided" so the API accepts both. */
function nullableText(max: number) {
  return z.preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    z.string().trim().max(max).nullable().optional(),
  );
}

function nullableInt(min: number, max: number) {
  return z.preprocess(
    (value) => (value === '' || value === undefined || value === null ? null : value),
    z.coerce.number().int().min(min).max(max).nullable().optional(),
  );
}

function nullableMoney() {
  return z.preprocess(
    (value) => (value === '' || value === undefined || value === null ? null : value),
    z.coerce.number().finite().min(0).max(1_000_000_000_000).nullable().optional(),
  );
}

const propertyFields = {
  type: nullableText(80),
  pinCode: nullableText(12),
  bathrooms: nullableInt(0, 100),
  parking: z.preprocess(
    (value) => (value === '' ||value === undefined ? null : value),
    z.coerce.boolean().nullable().optional(),
  ),
  area: nullableInt(0, 2_147_483_647),
  facing: nullableText(40),
  availableFrom: z.preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD format')
      .nullable()
      .optional(),
  ),
  description: nullableText(4000),
  unitIdentifier: nullableText(60),
  projectId: nullableInt(1, Number.MAX_SAFE_INTEGER),

  // SALE only
  priceNegotiable: z.preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    z.coerce.boolean().nullable().optional(),
  ),
  ownershipType: nullableText(60),

  // RENT only
  depositAmount: nullableMoney(),
  maintenanceAmount: nullableMoney(),
  furnishing: nullableText(60),
};

export const createPropertySchema = z.object({
  listingType: listingTypeSchema,
  city: z.string().trim().min(1, 'City is required').max(120),
  address: z.string().trim().min(1, 'Address is required').max(500),
  rooms: z.string().trim().min(1, 'Configuration is required').max(60),
  price: z.coerce
    .number()
    .finite()
    .min(0, 'Price cannot be negative')
    .max(1_000_000_000_000, 'Price is too large'),
  ...propertyFields,
});

export const updatePropertySchema = z
  .object({
    city: z.string().trim().min(1, 'City is required').max(120).optional(),
    address: z.string().trim().min(1, 'Address is required').max(500).optional(),
    rooms: z.string().trim().min(1, 'Configuration is required').max(60).optional(),
    price: z.coerce.number().finite().min(0).max(1_000_000_000_000).optional(),
    /** Last known updatedAt, for optimistic concurrency control. */
    expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
    ...propertyFields,
  })
  .strict();

export const listPropertiesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  listingType: listingTypeSchema.optional(),
  publicationStatus: publicationStatusSchema.optional(),
  availabilityStatus: availabilityStatusSchema.optional(),
  projectId: z.coerce.number().int().min(1).optional(),
  sort: z
    .enum(['updatedAt:desc', 'updatedAt:asc', 'createdAt:desc', 'price:asc', 'price:desc'])
    .default('updatedAt:desc'),
});

export const archivePropertySchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const setAvailabilitySchema = z.object({
  availabilityStatus: availabilityStatusSchema,
});

export const publicListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  listingType: listingTypeSchema.optional(),
  city: z.string().trim().max(120).optional(),
  projectId: z.coerce.number().int().min(1).optional(),
  minPrice: z.coerce.number().finite().min(0).optional(),
  maxPrice: z.coerce.number().finite().min(0).optional(),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type ListPropertiesQuery = z.infer<typeof listPropertiesQuerySchema>;
export type PublicListQuery = z.infer<typeof publicListQuerySchema>;
