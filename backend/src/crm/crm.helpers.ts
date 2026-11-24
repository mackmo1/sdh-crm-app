import { z } from 'zod';

/** Treats an empty form value as "not provided". */
export function optionalText(max: number) {
  return z.preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    z.string().trim().max(max).nullable().optional(),
  );
}

export function optionalId() {
  return z.preprocess(
    (value) => (value === '' || value === undefined || value === null ? null : value),
    z.coerce.number().int().min(1).nullable().optional(),
  );
}

export function optionalMoney() {
  return z.preprocess(
    (value) => (value === '' || value === undefined || value === null ? null : value),
    z.coerce.number().finite().min(0).max(1_000_000_000_000).nullable().optional(),
  );
}

export function optionalDateTime() {
  return z.preprocess(
    (value) => (value === '' || value === undefined || value === null ? null : value),
    z
      .string()
      .refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date and time')
      .nullable()
      .optional(),
  );
}

export const pageSchema = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
} as const;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function buildMeta(page: number, pageSize: number, total: number): PaginationMeta {
  return { page, pageSize, total, totalPages: total === 0 ? 0 : Math.ceil(total / pageSize) };
}

/** Days/hours used consistently by task due-date views. */
export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}
