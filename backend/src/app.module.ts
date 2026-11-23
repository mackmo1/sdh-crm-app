import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { HealthController } from './health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { PropertiesModule } from './properties/properties.module.js';

@Module({
  imports: [PrismaModule, AuthModule, PropertiesModule, ProjectsModule],
  controllers: [HealthController],
})
export class AppModule {}
