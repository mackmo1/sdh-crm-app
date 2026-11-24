import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AccessGuard, Modules } from '../auth/access.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { validate } from '../common/zod-validation.pipe.js';
import { DashboardService, dashboardQuerySchema } from './dashboard.service.js';

@Controller('dashboard')
@UseGuards(SessionGuard, AccessGuard)
@Modules('lead')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  overview(@Query(validate(dashboardQuerySchema)) query: z.infer<typeof dashboardQuerySchema>) {
    return this.dashboard.overview(query);
  }
}

@Controller('reports')
@UseGuards(SessionGuard, AccessGuard)
@Modules('lead')
export class ReportsController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('staff')
  staff(@Query(validate(dashboardQuerySchema)) query: z.infer<typeof dashboardQuerySchema>) {
    return this.dashboard.staffPerformance(query);
  }

  @Get('overview')
  overview(@Query(validate(dashboardQuerySchema)) query: z.infer<typeof dashboardQuerySchema>) {
    return this.dashboard.overview(query);
  }
}
