import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PropertiesController } from './properties.controller.js';
import { PublicPropertiesController } from './public-properties.controller.js';
import { PropertiesService } from './properties.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PropertiesController, PublicPropertiesController],
  providers: [PropertiesService],
})
export class PropertiesModule {}
