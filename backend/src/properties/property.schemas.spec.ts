import { describe, expect, it } from 'vitest';
import {
  createPropertySchema,
  listPropertiesQuerySchema,
  updatePropertySchema,
} from './property.schemas.js';

describe('createPropertySchema', () => {
  const minimal = {
    listingType: 'SALE',
    city: 'Mumbai',
    address: 'Andheri West',
    rooms: '2BHK',
    price: 25_000_000,
  };

  it('accepts a minimal draft', () => {
    const result = createPropertySchema.parse(minimal);
    expect(result.listingType).toBe('SALE');
    expect(result.price).toBe(25_000_000);
  });

  it('requires the identifying fields', () => {
    expect(createPropertySchema.safeParse({ ...minimal, city: '' }).success).toBe(false);
    expect(createPropertySchema.safeParse({ ...minimal, address: '' }).success).toBe(false);
    expect(createPropertySchema.safeParse({ ...minimal, rooms: '' }).success).toBe(false);
  });

  it('rejects a negative price', () => {
    expect(createPropertySchema.safeParse({ ...minimal, price: -1 }).success).toBe(false);
  });

  it('rejects an unknown listing type', () => {
    expect(createPropertySchema.safeParse({ ...minimal, listingType: 'BOTH' }).success).toBe(false);
  });

  it('treats empty optional strings as absent', () => {
    const result = createPropertySchema.parse({ ...minimal, type: '', facing: '', unitIdentifier: '' });
    expect(result.type).toBeNull();
    expect(result.facing).toBeNull();
    expect(result.unitIdentifier).toBeNull();
  });

  it('accepts rental fields on a rental listing', () => {
    const result = createPropertySchema.parse({
      ...minimal,
      listingType: 'RENT',
      depositAmount: 90_000,
      furnishing: 'Furnished',
    });
    expect(result.depositAmount).toBe(90_000);
  });

  it('rejects a malformed availability date', () => {
    expect(createPropertySchema.safeParse({ ...minimal, availableFrom: '12/03/2026' }).success).toBe(
      false,
    );
  });
});

describe('updatePropertySchema', () => {
  it('accepts a partial update', () => {
    expect(updatePropertySchema.parse({ address: 'Bandra' }).address).toBe('Bandra');
  });

  it('rejects unknown fields', () => {
    expect(updatePropertySchema.safeParse({ publicationStatus: 'PUBLISHED' }).success).toBe(false);
  });
});

describe('listPropertiesQuerySchema', () => {
  it('applies pagination defaults', () => {
    const result = listPropertiesQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.sort).toBe('updatedAt:desc');
  });

  it('caps the page size', () => {
    expect(listPropertiesQuerySchema.safeParse({ pageSize: 500 }).success).toBe(false);
  });

  it('rejects an unknown sort order', () => {
    expect(listPropertiesQuerySchema.safeParse({ sort: 'price:sideways' }).success).toBe(false);
  });
});
