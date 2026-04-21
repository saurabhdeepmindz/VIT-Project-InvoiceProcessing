/**
 * @file   user.entity.ts
 * @module Auth
 *
 * @description
 * TypeORM entity for the users table. Supports EPIC-001 auth (login/refresh)
 * and role-based access for EPIC-002 to EPIC-007 controllers.
 *
 * @since 1.0.0
 */

import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, Index,
} from 'typeorm';

export type UserRole = 'ADMIN' | 'INVOICE_OPERATOR';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

@Entity('users')
@Index(['email'])
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  /** bcrypt hash — never the plaintext */
  @Column({ type: 'varchar', length: 255 })
  password_hash!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  full_name!: string | null;

  @Column({ type: 'varchar', length: 50, default: 'INVOICE_OPERATOR' })
  role!: UserRole;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: UserStatus;

  /** bcrypt hash of the current refresh token (rotated on each refresh) */
  @Column({ type: 'varchar', length: 255, nullable: true })
  refresh_token_hash!: string | null;

  /** bcrypt hash of the active password-reset token (cleared on successful reset) */
  @Column({ type: 'varchar', length: 255, nullable: true })
  reset_token_hash!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reset_token_expires_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_login_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
