/**
 * @file   RolesGuard.ts
 * @module Common / Guards
 *
 * @description
 * Role-based access control guard. Reads @Roles() metadata and checks
 * the authenticated user's role.
 *
 * Use with: @UseGuards(JwtAuthGuard, RolesGuard)
 *
 * @since 1.0.0
 */

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { UserRole } from '../../auth/entities/user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: { role?: UserRole } }>();
    return !!user?.role && required.includes(user.role);
  }
}
