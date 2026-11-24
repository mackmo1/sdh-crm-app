import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Validates a request value against a Zod schema and replaces it with the
 * parsed result, so controllers work with fully typed and narrowed data.
 */
@Injectable()
export class ZodValidationPipe<T extends ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    // Endpoints that accept an optional JSON body may receive `undefined` when
    // the request has no payload at all.
    const input = value === undefined ? {} : value;
    const result = this.schema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}

export function validate<T extends ZodType>(schema: T): ZodValidationPipe<T> {
  return new ZodValidationPipe(schema);
}
