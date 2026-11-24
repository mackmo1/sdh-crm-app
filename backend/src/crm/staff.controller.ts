import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AccessGuard, CurrentUser, Roles } from '../auth/access.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { validate } from '../common/zod-validation.pipe.js';
import {
  staffCreateSchema,
  staffListQuerySchema,
  StaffService,
  staffUpdateSchema,
} from './staff.service.js';

@Controller('staff')
@UseGuards(SessionGuard, AccessGuard)
@Roles('admin')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  list(@Query(validate(staffListQuerySchema)) query: z.infer<typeof staffListQuerySchema>) {
    return this.staff.list(query);
  }

  @Post()
  create(@Body(validate(staffCreateSchema)) body: z.infer<typeof staffCreateSchema>) {
    return this.staff.create(body);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body(validate(staffUpdateSchema)) body: z.infer<typeof staffUpdateSchema>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.staff.update(id, body, user.id);
  }
}

/**
 * Staff names are needed by anyone who assigns a lead, so the directory is
 * readable by any authenticated user while the management endpoints above
 * remain administrator-only.
 */
@Controller('staff-directory')
@UseGuards(SessionGuard)
export class StaffDirectoryController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  list() {
    return this.staff.options();
  }
}
