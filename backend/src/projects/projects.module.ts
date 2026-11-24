import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ChangeHistoryService } from '../crm/change-history.service.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ChangeHistoryService],
})
export class ProjectsModule {}
