import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AccessGuard, CurrentUser, Modules } from '../auth/access.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { parseId } from '../common/parse-id.js';
import { validate } from '../common/zod-validation.pipe.js';
import {
  inventoryQuerySchema,
  listProjectsQuerySchema,
  projectCreateSchema,
  ProjectsService,
  projectUpdateSchema,
} from './projects.service.js';

@Controller('projects')
@UseGuards(SessionGuard, AccessGuard)
@Modules('property')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@Query(validate(listProjectsQuerySchema)) query: z.infer<typeof listProjectsQuerySchema>) {
    return this.projects.list(query);
  }

  @Get('options')
  options() {
    return this.projects.options();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projects.findOne(parseId(id));
  }

  @Post()
  create(
    @Body(validate(projectCreateSchema)) body: z.infer<typeof projectCreateSchema>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.create(body, user.id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body(validate(projectUpdateSchema)) body: z.infer<typeof projectUpdateSchema>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.update(parseId(id), body, user.id);
  }

  @Post(':id/archive')
  @HttpCode(200)
  archive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projects.archive(parseId(id), user.id);
  }

  @Post(':id/restore')
  @HttpCode(200)
  restore(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projects.restore(parseId(id), user.id);
  }

  @Get(':id/inventory')
  inventory(
    @Param('id') id: string,
    @Query(validate(inventoryQuerySchema)) query: z.infer<typeof inventoryQuerySchema>,
  ) {
    return this.projects.inventory(parseId(id), query);
  }
}
