import { BadRequestException, Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { AccessGuard, CurrentUser, Roles } from '../auth/access.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { validate } from '../common/zod-validation.pipe.js';
import {
  DataTransferService,
  importCommitSchema,
  importPreviewSchema,
  isImportEntity,
  type ImportEntity,
} from './data-transfer.service.js';

@Controller('data')
@UseGuards(SessionGuard, AccessGuard)
@Roles('admin')
export class DataTransferController {
  constructor(private readonly data: DataTransferService) {}

  @Get('export/:entity')
  async export(
    @Param('entity') entity: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    const target = this.assertEntity(entity);
    const result = await this.data.exportCsv(target);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return result.csv;
  }

  @Post('import/:entity/preview')
  preview(
    @Param('entity') entity: string,
    @Body(validate(importPreviewSchema)) body: z.infer<typeof importPreviewSchema>,
  ) {
    return this.data.preview(this.assertEntity(entity), body.csv);
  }

  @Post('import/:entity')
  async commit(
    @Param('entity') entity: string,
    @Body(validate(importCommitSchema)) body: z.infer<typeof importCommitSchema>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.data.commit(this.assertEntity(entity), body.csv, body.excludeRows, user.id);
  }

  private assertEntity(value: string): ImportEntity {
    if (!isImportEntity(value)) {
      throw new BadRequestException(`Unsupported entity: ${value}`);
    }
    return value;
  }
}
