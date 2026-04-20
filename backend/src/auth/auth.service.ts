/**
 * @file   auth.service.ts
 * @module Auth
 *
 * @description
 * EPIC-001 minimal auth service. Supports login, JWT access + refresh,
 * rotation of refresh token on each refresh, and logout (token revocation).
 *
 * @since 1.0.0
 */

import {
  Injectable, UnauthorizedException, OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService }    from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import * as bcrypt          from 'bcrypt';
import type { SignOptions } from 'jsonwebtoken';
import { UserEntity }       from './entities/user.entity';
import { AppLogger }        from '../common/logger/AppLogger';
import type { LoginDto }    from './dto/login.dto';
import type { AuthResponseDto } from './dto/auth-response.dto';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext('AuthService');
  }

  /** Seeds the default admin + operator users on first boot (EPIC-001 demo). */
  async onModuleInit(): Promise<void> {
    const saltRounds = Number(this.config.get<string>('BCRYPT_SALT_ROUNDS') ?? 12);
    const seeds: Array<{ email: string; pass: string; role: 'ADMIN' | 'INVOICE_OPERATOR'; name: string }> = [
      {
        email: this.config.get<string>('SEED_ADMIN_EMAIL')    ?? 'admin@invoice-platform.local',
        pass:  this.config.get<string>('SEED_ADMIN_PASSWORD') ?? 'ChangeMe!Admin#2026',
        role:  'ADMIN',
        name:  'Platform Admin',
      },
      {
        email: this.config.get<string>('SEED_OPERATOR_EMAIL')    ?? 'operator@invoice-platform.local',
        pass:  this.config.get<string>('SEED_OPERATOR_PASSWORD') ?? 'ChangeMe!Op#2026',
        role:  'INVOICE_OPERATOR',
        name:  'Invoice Operator',
      },
    ];

    for (const s of seeds) {
      const existing = await this.users.findOne({ where: { email: s.email } });
      if (existing) continue;
      const password_hash = await bcrypt.hash(s.pass, saltRounds);
      await this.users.save(this.users.create({
        email: s.email, password_hash, full_name: s.name, role: s.role, status: 'ACTIVE',
      }));
      this.logger.log('Seeded user', { email: s.email, role: s.role });
    }
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.users.findOne({ where: { email: dto.email } });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Invalid credentials');

    const matches = await bcrypt.compare(dto.password, user.password_hash);
    if (!matches) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.issueTokens(user);
    await this.persistRefresh(user.id, tokens.refreshToken);
    await this.users.update(user.id, { last_login_at: new Date() });

    this.logger.audit({
      actor: user.email, action: 'auth.login',
      target: { type: 'user', id: user.id },
    });

    return { ...tokens, accessExpiresIn: this.config.get<string>('JWT_ACCESS_EXPIRY') ?? '15m',
      user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name } };
  }

  async refresh(userId: string, presentedToken: string): Promise<AuthResponseDto> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || !user.refresh_token_hash) throw new UnauthorizedException('Invalid refresh token');

    const matches = await bcrypt.compare(presentedToken, user.refresh_token_hash);
    if (!matches) throw new UnauthorizedException('Invalid refresh token');

    const tokens = await this.issueTokens(user);
    await this.persistRefresh(user.id, tokens.refreshToken);

    return { ...tokens, accessExpiresIn: this.config.get<string>('JWT_ACCESS_EXPIRY') ?? '15m',
      user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name } };
  }

  async logout(userId: string): Promise<void> {
    await this.users.update(userId, { refresh_token_hash: null });
    this.logger.audit({ actor: userId, action: 'auth.logout', target: { type: 'user', id: userId } });
  }

  private async issueTokens(user: UserEntity): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };

    const accessSecret  = this.config.get<string>('JWT_ACCESS_SECRET')!;
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET')!;
    const accessExpiry  = (this.config.get<string>('JWT_ACCESS_EXPIRY')  ?? '15m') as SignOptions['expiresIn'];
    const refreshExpiry = (this.config.get<string>('JWT_REFRESH_EXPIRY') ?? '7d')  as SignOptions['expiresIn'];

    const accessToken  = await this.jwt.signAsync(payload, { secret: accessSecret,  expiresIn: accessExpiry  });
    const refreshToken = await this.jwt.signAsync(payload, { secret: refreshSecret, expiresIn: refreshExpiry });
    return { accessToken, refreshToken };
  }

  private async persistRefresh(userId: string, refreshToken: string): Promise<void> {
    const saltRounds = Number(this.config.get<string>('BCRYPT_SALT_ROUNDS') ?? 12);
    const hash = await bcrypt.hash(refreshToken, saltRounds);
    await this.users.update(userId, { refresh_token_hash: hash });
  }
}
