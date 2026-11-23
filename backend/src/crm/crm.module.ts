import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ContactsController } from './contacts.controller.js';
import { ContactsService } from './contacts.service.js';
import { DashboardController, ReportsController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { LeadsController } from './leads.controller.js';
import { LeadsService } from './leads.service.js';
import { SiteVisitsController } from './site-visits.controller.js';
import { SiteVisitsService } from './site-visits.service.js';
import { StaffController, StaffDirectoryController } from './staff.controller.js';
import { StaffService } from './staff.service.js';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    ContactsController,
    LeadsController,
    TasksController,
    SiteVisitsController,
    DashboardController,
    ReportsController,
    StaffController,
    StaffDirectoryController,
  ],
  providers: [ContactsService, LeadsService, TasksService, SiteVisitsService, DashboardService, StaffService],
})
export class CrmModule {}
