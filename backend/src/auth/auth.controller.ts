import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../common/zod-validation.pipe.js';
import { guardedRateLimit } from '../common/rate-limit.guard.js';
import { config } from '../config.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './access.guard.js';
import { SessionGuard } from './session.guard.js';
import { readCookie, SESSION_COOKIE } from './tokens.js';
import type { AuthenticatedUser } from './auth.types.js';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(200, 'Password is too long'),
});

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.cookieSecure,
    path: '/',
    maxAge: config.sessionTtlHours * 60 * 60 * 1000,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @UseGuards(guardedRateLimit(10, 15 * 60 * 1000))
  @HttpCode(200)
  async login(
    @Body(validate(loginSchema)) body: z.infer<typeof loginSchema>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: AuthenticatedUser }> {
    const result = await this.auth.login(body.email, body.password);
    response.cookie(SESSION_COOKIE, result.token, sessionCookieOptions());
    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    if (token) {
      await this.auth.logout(token);
    }
    response.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: AuthenticatedUser): { user: AuthenticatedUser } {
    return { user };
  }

  @Post('forgot-password')
  @UseGuards(guardedRateLimit(5, 60 * 60 * 1000))
  @HttpCode(200)
  async forgotPassword(
    @Body(validate(forgotPasswordSchema)) body: z.infer<typeof forgotPasswordSchema>,
  ): Promise<{ delivered: boolean; transport: string }> {
    const result = await this.auth.requestPasswordReset(body.email);
    return { delivered: result.delivered, transport: result.transport };
  }

  @Post('reset-password')
  @HttpCode(204)
  async resetPassword(
    @Body(validate(resetPasswordSchema)) body: z.infer<typeof resetPasswordSchema>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.resetPassword(body.token, body.password);
    response.clearCookie(SESSION_COOKIE, { path: '/' });
  }
}
