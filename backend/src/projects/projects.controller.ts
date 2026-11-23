import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AccessGuard, Modules } from '../auth/access.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { parseId } from '../common/parse-id.js';
import { validate } from '../common/zod-validation.pipe.js';
import { inventoryQuerySchema, listProjectsQuerySchema, ProjectsService } from './projects.service.js';

@Controller('projects')
@UseGuards(SessionGuard, AccessGuard)
@Modules('property')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@Query(validate(listProjectsQuerySchema)) query: z.infer<typeof listProjectsQuerySchema>) {
    return this.projects.list(query);
  }

  @Get(':id/inventory')
  inventory(
    @Param('id') id: string,
    @Query(validate(inventoryQuerySchema)) query: z.infer<typeof inventoryQuerySchema>,
  ) {
    return this.projects.inventory(parseId(id), query);
  }
}
