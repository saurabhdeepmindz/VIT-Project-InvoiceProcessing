/**
 * @file   roles.decorator.ts
 * @module Common
 *
 * @description
 * @Roles(...) decorator. Attaches required-roles metadata to a handler
 * method or controller class. RolesGuard reads this via Reflector.
 *
 * @since 1.0.0
 */

import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../auth/entities/user.entity';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
