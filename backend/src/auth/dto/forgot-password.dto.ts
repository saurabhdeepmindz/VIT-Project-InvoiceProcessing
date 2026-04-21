/**
 * @file   forgot-password.dto.ts
 * @module Auth
 * @since  3.1.0
 */

import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'operator@invoice-platform.local' })
  @IsEmail()
  email!: string;
}
