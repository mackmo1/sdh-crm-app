import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * Translates the Prisma errors that represent normal business conflicts into
 * HTTP responses instead of leaking them as 500s.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    switch (exception.code) {
      case 'P2002': {
        const target = exception.meta?.target;
        const fields = Array.isArray(target) ? target.join(', ') : 'the submitted values';
        response.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          message: `A record with the same ${fields} already exists`,
        });
        return;
      }
      case 'P2025':
      case 'P2001':
        response.status(HttpStatus.NOT_FOUND).json({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Record not found',
        });
        return;
      case 'P2003':
        response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'A referenced record does not exist',
        });
        return;
      default:
        this.logger.error(`Unhandled Prisma error ${exception.code}: ${exception.message}`);
        response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
        });
    }
  }
}
