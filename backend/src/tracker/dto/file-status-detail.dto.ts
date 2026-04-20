/**
 * @file   file-status-detail.dto.ts
 * @module Tracker (EPIC-005)
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FileStatusRowDto } from './file-status-list.dto';

export class TrackerRecordDto {
  @ApiProperty() recordId!: string;
  @ApiProperty() csvRowNumber!: number;
  @ApiProperty() sourceUrl!: string;
  @ApiProperty() preprocessingStatus!: string;
  @ApiProperty() edaStatus!: string;
  @ApiPropertyOptional({ nullable: true }) pageCount!: number | null;
  @ApiPropertyOptional({ nullable: true }) confidenceScore!: number | null;
  @ApiPropertyOptional({ nullable: true }) extractionStatus!: string | null;
  @ApiPropertyOptional({ nullable: true }) errorMessage!: string | null;
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
  @ApiPropertyOptional({ nullable: true }) llmProviderUsed!: string | null;
}

export class TrackerAuditEntryDto {
  @ApiProperty() action!: string;
  @ApiProperty() actor!: string;
  @ApiPropertyOptional({ nullable: true }) recordId!: string | null;
  @ApiPropertyOptional({ nullable: true }) payload!: Record<string, unknown> | null;
  @ApiProperty() createdAt!: string;
}

export class TrackerDlqEntryDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({ nullable: true }) recordId!: string | null;
  @ApiProperty() failureStage!: string;
  @ApiPropertyOptional({ nullable: true }) errorCode!: string | null;
  @ApiPropertyOptional({ nullable: true }) errorMessage!: string | null;
  @ApiProperty() attempts!: number;
  @ApiProperty() createdAt!: string;
}

export class FileStatusDetailDto {
  @ApiProperty({ type: FileStatusRowDto }) summary!: FileStatusRowDto;
  @ApiProperty({ type: [TrackerRecordDto] }) records!: TrackerRecordDto[];
  @ApiProperty({ type: [TrackerAuditEntryDto] }) auditTail!: TrackerAuditEntryDto[];
  @ApiProperty({ type: [TrackerDlqEntryDto] }) dlq!: TrackerDlqEntryDto[];
}
