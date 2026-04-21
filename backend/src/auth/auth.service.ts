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
  Injectable, UnauthorizedException, BadRequestException, OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService }    from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import * as bcrypt          from 'bcrypt';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
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

    if (!this.refreshTokenMatches(presentedToken, user.refresh_token_hash)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.issueTokens(user);
    await this.persistRefresh(user.id, tokens.refreshToken);

    return { ...tokens, accessExpiresIn: this.config.get<string>('JWT_ACCESS_EXPIRY') ?? '15m',
      user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name } };
  }

  /**
   * Refresh tokens are already high-entropy (JWT-signed), so bcrypt's iteration
   * cost adds nothing — and bcrypt is actually UNSAFE here: it truncates input
   * at 72 bytes, and the first 72 bytes of our JWTs are identical across
   * refreshes for the same user (algo header + start of payload), so
   * bcrypt.compare would return true for ANY previous refresh token — silently
   * bypassing rotation. SHA-256 + timing-safe compare avoids both issues.
   */
  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private refreshTokenMatches(presented: string, stored: string): boolean {
    const a = Buffer.from(this.hashRefreshToken(presented), 'hex');
    const b = Buffer.from(stored, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  async logout(userId: string): Promise<void> {
    await this.users.update(userId, { refresh_token_hash: null });
    this.logger.audit({ actor: userId, action: 'auth.logout', target: { type: 'user', id: userId } });
  }

  /**
   * Generate a password-reset token and email it out-of-band.
   *
   * For security we always return the same "if the email exists we sent a link"
   * response — this prevents enumeration attacks. In dev mode (no SMTP wired)
   * the token is emitted to the backend log, which is how the operator can
   * complete the flow for the demo.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.users.findOne({ where: { email } });
    if (!user || user.status !== 'ACTIVE') {
      this.logger.warn('Password-reset requested for unknown/inactive email', { email });
      return;   // swallow — same response whether email exists or not
    }

    const saltRounds = Number(this.config.get<string>('BCRYPT_SALT_ROUNDS') ?? 12);
    const token = randomBytes(32).toString('hex');     // 64-char hex opaque token
    const tokenHash = await bcrypt.hash(token, saltRounds);
    const ttlMinutes = Number(this.config.get<string>('PASSWORD_RESET_TTL_MINUTES') ?? 60);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

    await this.users.update(user.id, {
      reset_token_hash: tokenHash,
      reset_token_expires_at: expiresAt,
    });

    const resetUrl = `${this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000'}/reset-password?token=${token}`;

    // Dev/demo: log the reset URL. Production should send via the configured email provider.
    this.logger.log('Password reset token issued', {
      email, resetUrl, expiresAt: expiresAt.toISOString(), ttlMinutes,
    });
    this.logger.audit({
      actor: email, action: 'auth.password_reset.requested',
      target: { type: 'user', id: user.id },
      metadata: { ttlMinutes },
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!token || !newPassword) throw new BadRequestException('token and newPassword are required');

    // We can't look up by hash (bcrypt hashes are non-deterministic). Scan users
    // with an unexpired reset token and try each. Only seeded + active demo users
    // are in scope for now; the set is small.
    const candidates = await this.users
      .createQueryBuilder('u')
      .where('u.reset_token_hash IS NOT NULL')
      .andWhere('u.reset_token_expires_at > :now', { now: new Date() })
      .getMany();

    let matched: UserEntity | null = null;
    for (const u of candidates) {
      if (u.reset_token_hash && await bcrypt.compare(token, u.reset_token_hash)) {
        matched = u;
        break;
      }
    }
    if (!matched) throw new BadRequestException('Invalid or expired reset token');

    const saltRounds = Number(this.config.get<string>('BCRYPT_SALT_ROUNDS') ?? 12);
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    await this.users.update(matched.id, {
      password_hash: passwordHash,
      reset_token_hash: null,
      reset_token_expires_at: null,
      refresh_token_hash: null,        // force re-login everywhere
    });

    this.logger.audit({
      actor: matched.email, action: 'auth.password_reset.completed',
      target: { type: 'user', id: matched.id },
    });
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
    // Deterministic SHA-256 — see refreshTokenMatches for why we don't use bcrypt here.
    await this.users.update(userId, { refresh_token_hash: this.hashRefreshToken(refreshToken) });
  }
}
