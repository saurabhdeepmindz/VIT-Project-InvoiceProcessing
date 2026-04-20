/**
 * @file   upload-csv.dto.ts
 * @module Invoice (EPIC-002)
 *
 * @description
 * Placeholder DTO for the multipart upload route. The actual file comes in
 * via @UploadedFile() (multer) — this DTO exists so future fields (batch
 * label, tags, etc.) can be added without breaking the controller shape.
 *
 * @since 3.1.0
 */

import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UploadCsvDto {
  @ApiPropertyOptional({ description: 'Optional operator-supplied label for the batch' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;
}
