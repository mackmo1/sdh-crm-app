import { BadRequestException } from '@nestjs/common';

/**
 * Parses a BigInt id coming from a route parameter or query string.
 * PostgreSQL ids are 64-bit and are therefore kept as BigInt end to end.
 */
export function parseId(value: string, label = 'id'): bigint {
  if (!/^\d+$/.test(value)) {
    throw new BadRequestException(`Invalid ${label}`);
  }
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestException(`Invalid ${label}`);
  }
}

export function parseOptionalId(value: string | undefined, label = 'id'): bigint | undefined {
  if (value === undefined || value === '') return undefined;
  return parseId(value, label);
}
