/**
 * @file   refresh.strategy.ts
 * @module Auth
 *
 * @description
 * passport-jwt strategy for the refresh token endpoint only.
 * Uses a separate secret (JWT_REFRESH_SECRET) and different Bearer source
 * to keep refresh tokens out of the access-token flow.
 *
 * @since 1.0.0
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import type { JwtPayload } from '../auth.service';

export interface RefreshRequestUser {
  id: string;
  email: string;
  role: string;
  presentedToken: string;
}

@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: (req: Request): string | null => {
        const body = req.body as { refreshToken?: string } | undefined;
        return body?.refreshToken ?? null;
      },
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_REFRESH_SECRET') ?? 'CHANGE_ME',
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload): RefreshRequestUser {
    const body = req.body as { refreshToken?: string } | undefined;
    const presentedToken = body?.refreshToken;
    if (!presentedToken) throw new UnauthorizedException('Refresh token missing');
    return { id: payload.sub, email: payload.email, role: payload.role, presentedToken };
  }
}
