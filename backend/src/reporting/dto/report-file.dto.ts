/**
 * @file   report-file.dto.ts
 * @module Reporting
 */

import { ApiProperty } from '@nestjs/swagger';

export class ReportFileDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['SINGLE_FILE', 'WEEKLY', 'ERROR'] })
  reportType!: string;
  @ApiProperty({ enum: ['CSV', 'XLSX'] })
  fileFormat!: string;
  @ApiProperty() filePath!: string;
  @ApiProperty() recordCount!: number;
  @ApiProperty() parameters!: Record<string, string>;
  @ApiProperty() generatedByUserId!: string;
  @ApiProperty() generatedAt!: string;
}

export class ReportListDto {
  @ApiProperty({ type: [ReportFileDto] }) data!: ReportFileDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}
