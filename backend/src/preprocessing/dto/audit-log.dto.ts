import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuditLogDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({ nullable: true }) batchId!: string | null;
  @ApiPropertyOptional({ nullable: true }) recordId!: string | null;
  @ApiProperty() action!: string;
  @ApiProperty() actor!: string;
  @ApiPropertyOptional({ nullable: true }) payload!: Record<string, unknown> | null;
  @ApiProperty() createdAt!: string;
}
