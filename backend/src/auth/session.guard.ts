import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { readCookie, SESSION_COOKIE } from './tokens.js';
import type { RequestWithUser } from './auth.types.js';

/** Resolves the session cookie into `request.user`, or rejects the request. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & RequestWithUser>();
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    const user = await this.auth.resolveSession(token);
    if (!user) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    request.user = user;
    return true;
  }
}
