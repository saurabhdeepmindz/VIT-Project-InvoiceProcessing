/**
 * @file   public.decorator.ts
 * @module Common
 *
 * @description
 * @Public() decorator. Marks a route as publicly accessible (skips JwtAuthGuard).
 * Used on login, refresh, and health endpoints.
 *
 * @since 1.0.0
 */

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
