/**
 * @file   auth-response.dto.ts
 * @module Auth
 * @since 1.0.0
 */

import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() role!: string;
  @ApiProperty({ nullable: true }) full_name!: string | null;
}

export class AuthResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ type: AuthUserDto }) user!: AuthUserDto;
  @ApiProperty({ example: '15m' }) accessExpiresIn!: string;
}
