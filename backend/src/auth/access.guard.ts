import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  createParamDecorator,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CrmModule, StaffRole } from '@prisma/client';
import type { Request } from 'express';
import type { AuthenticatedUser, RequestWithUser } from './auth.types.js';

export const ROLES_KEY = 'access:roles';
export const MODULES_KEY = 'access:modules';

/** Restricts an endpoint to the listed roles. */
export const Roles = (...roles: StaffRole[]) => SetMetadata(ROLES_KEY, roles);

/** Restricts an endpoint to the listed modules. `all` and `admin` pass. */
export const Modules = (...modules: CrmModule[]) => SetMetadata(MODULES_KEY, modules);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<Request & RequestWithUser>();
    if (!request.user) {
      throw new UnauthorizedException('Authentication required');
    }
    return request.user;
  },
);

/**
 * Role and module authorisation. Administrators are unrestricted; a
 * `data_user` may only reach the modules they are assigned, and `all` grants
 * every module.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const requiredRoles = this.reflector.getAllAndOverride<StaffRole[]>(ROLES_KEY, targets);
    const requiredModules = this.reflector.getAllAndOverride<CrmModule[]>(MODULES_KEY, targets);

    const request = context.switchToHttp().getRequest<Request & RequestWithUser>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (requiredRoles?.length && !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Your role does not permit this action');
    }

    if (requiredModules?.length && user.role !== 'admin') {
      const permitted = user.module === 'all' || requiredModules.includes(user.module);
      if (!permitted) {
        throw new ForbiddenException('Your module does not permit this action');
      }
    }

    return true;
  }
}
