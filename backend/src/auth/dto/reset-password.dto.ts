/**
 * @file   reset-password.dto.ts
 * @module Auth
 * @since  3.1.0
 */

import { IsString, Matches, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'The opaque token the operator received out-of-band' })
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  token!: string;

  @ApiProperty({ description: 'New password, min 8 chars, must contain a digit' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/\d/, { message: 'password must contain at least one digit' })
  newPassword!: string;
}
