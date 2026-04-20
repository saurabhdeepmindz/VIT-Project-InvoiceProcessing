/**
 * @file   refresh.dto.ts
 * @module Auth
 * @since 1.0.0
 */

import { IsJWT } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @ApiProperty({ description: 'Previously-issued refresh JWT' })
  @IsJWT()
  refreshToken!: string;
}
