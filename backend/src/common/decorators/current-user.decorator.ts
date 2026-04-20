/**
 * @file   current-user.decorator.ts
 * @module Common
 *
 * @description
 * Parameter decorator. Extracts the authenticated user from the request.
 * Populated by JwtStrategy.validate() — returned value is attached as req.user.
 *
 * @example async someHandler(@CurrentUser() user: AuthenticatedUser)
 * @since 1.0.0
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    return request.user;
  },
);
