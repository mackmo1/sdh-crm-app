import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AccessGuard, CurrentUser, Modules } from '../auth/access.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { parseId } from '../common/parse-id.js';
import { validate } from '../common/zod-validation.pipe.js';
import {
  SiteVisitsService,
  siteVisitCreateSchema,
  siteVisitListQuerySchema,
  siteVisitOutcomeSchema,
  siteVisitRescheduleSchema,
} from './site-visits.service.js';

@Controller('site-visits')
@UseGuards(SessionGuard, AccessGuard)
@Modules('lead')
export class SiteVisitsController {
  constructor(private readonly visits: SiteVisitsService) {}

  @Get()
  list(
    @Query(validate(siteVisitListQuerySchema)) query: z.infer<typeof siteVisitListQuerySchema>,
  ) {
    return this.visits.list(query);
  }

  @Post()
  create(
    @Body(validate(siteVisitCreateSchema)) body: z.infer<typeof siteVisitCreateSchema>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.visits.create(body, user.id);
  }

  @Post(':id/reschedule')
  @HttpCode(200)
  reschedule(
    @Param('id') id: string,
    @Body(validate(siteVisitRescheduleSchema)) body: z.infer<typeof siteVisitRescheduleSchema>,
  ) {
    return this.visits.reschedule(parseId(id), body);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(
    @Param('id') id: string,
    @Body(validate(siteVisitOutcomeSchema)) body: z.infer<typeof siteVisitOutcomeSchema>,
  ) {
    return this.visits.cancel(parseId(id), body.feedback ?? undefined);
  }

  @Post(':id/complete')
  @HttpCode(200)
  complete(
    @Param('id') id: string,
    @Body(validate(siteVisitOutcomeSchema)) body: z.infer<typeof siteVisitOutcomeSchema>,
  ) {
    return this.visits.complete(parseId(id), body);
  }

  @Post(':id/no-show')
  @HttpCode(200)
  noShow(
    @Param('id') id: string,
    @Body(validate(siteVisitOutcomeSchema)) body: z.infer<typeof siteVisitOutcomeSchema>,
  ) {
    return this.visits.noShow(parseId(id), body);
  }
}
