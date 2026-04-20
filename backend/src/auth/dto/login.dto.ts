/**
 * @file   login.dto.ts
 * @module Auth
 * @since 1.0.0
 */

import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'operator@invoice-platform.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'ChangeMe!Op#2026' })
  @IsString()
  @MinLength(8)
  password!: string;
}
