import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExtractionResultDto {
  @ApiProperty() recordId!: string;
  @ApiProperty() batchId!: string;
  @ApiProperty() extractionStatus!: string;
  @ApiProperty() confidenceScore!: number;
  @ApiProperty() llmProviderUsed!: string;
  @ApiPropertyOptional({ nullable: true }) dealerName!: string | null;
  @ApiPropertyOptional({ nullable: true }) customerName!: string | null;
  @ApiPropertyOptional({ nullable: true }) customerMobile!: string | null;
  @ApiPropertyOptional({ nullable: true }) vehicleRegistrationNumber!: string | null;
  @ApiPropertyOptional({ nullable: true }) tyreSize!: string | null;
  @ApiPropertyOptional({ nullable: true }) tyrePattern!: string | null;
  @ApiPropertyOptional({ nullable: true }) invoiceAmountExclGst!: string | null;
  @ApiPropertyOptional({ nullable: true }) gstAmount!: string | null;
  @ApiPropertyOptional({ nullable: true }) quantity!: number | null;
  @ApiPropertyOptional({ nullable: true }) invoiceDate!: string | null;
  @ApiPropertyOptional({ nullable: true }) invoiceNumber!: string | null;
  @ApiPropertyOptional({ nullable: true }) comments!: string | null;
  @ApiProperty() extractedAt!: string;
}

export class EdaBatchSummaryDto {
  @ApiProperty() batchId!: string;
  @ApiProperty() edaStatus!: string;
  @ApiProperty() totalRecords!: number;
  @ApiProperty() extractedRecords!: number;
  @ApiProperty() partialRecords!: number;
  @ApiProperty() failedRecords!: number;
  @ApiProperty() avgConfidence!: number | null;
  @ApiProperty({ nullable: true }) outputCsvPath!: string | null;
}
