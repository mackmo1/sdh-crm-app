import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailService } from './email.service.js';
import { AccessGuard } from './access.guard.js';
import { SessionGuard } from './session.guard.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, EmailService, SessionGuard, AccessGuard],
  exports: [AuthService, EmailService, SessionGuard, AccessGuard],
})
export class AuthModule {}
