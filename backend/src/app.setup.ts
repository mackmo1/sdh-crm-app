import type { INestApplication } from '@nestjs/common';
import { config } from './config.js';
import { PrismaExceptionFilter } from './common/prisma-exception.filter.js';

/**
 * Prisma returns 64-bit integer ids as BigInt, which JSON cannot represent.
 * Registering a serialiser keeps precision intact for API consumers.
 */
export function registerBigIntSerialisation(): void {
  (BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (
    this: bigint,
  ): string {
    return this.toString();
  };
}

/** Shared application configuration used by `main.ts` and by the tests. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.webOrigin, credentials: true });
  app.enableShutdownHooks();
  app.useGlobalFilters(new PrismaExceptionFilter());
}
