/**
 * @file   Entities.ts
 * @module All Modules — TypeORM Entity Definitions
 *
 * @description
 * TypeORM entity definitions for database tables across EPIC-002 to EPIC-007
 * plus the v3.1 dead_letter_records table.
 *
 * v3.1 additions:
 *  - InvoiceBatchEntity.csv_content_hash (CSV idempotency)
 *  - InvoiceRecordEntity.source_url, image_hash, page_count (URL ingestion + dedup + multi-page)
 *  - ExtractionResultEntity.ocr_text (corroboration signal)
 *  - DeadLetterRecordEntity (new)
 *
 * UserEntity is defined in src/auth/entities/user.entity.ts to keep auth concerns separate.
 *
 * @author  Invoice Processing Platform Engineering
 * @version 3.1.0
 * @since   2025-01-01
 */

import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, OneToMany, OneToOne, JoinColumn, Index,
} from 'typeorm';
import type { Relation } from 'typeorm';

/* ─────────────────────────────────────────────────────────────────
   EPIC-002: InvoiceBatchEntity
   ───────────────────────────────────────────────────────────────── */
@Entity('invoice_batches')
@Index(['user_id', 'created_at'])
export class InvoiceBatchEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  user_id!: string;

  @Column({ type: 'text', nullable: false })
  csv_path!: string;

  /** v3.1: SHA-256 of uploaded CSV bytes — enforces upload idempotency */
  @Column({ type: 'varchar', length: 64, unique: true })
  csv_content_hash!: string;

  @Column({ type: 'varchar', length: 50, default: 'UPLOADED' })
  status!: string;

  @Column({ type: 'int', default: 0 })
  batch_size!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @OneToMany(() => InvoiceRecordEntity, record => record.batch)
  records?: Relation<InvoiceRecordEntity>[];

  @OneToOne(() => ProcessingStatusEntity, status => status.batch)
  processing_status?: Relation<ProcessingStatusEntity>;

  @OneToOne(() => OutputFileEntity, output => output.batch)
  output_file?: Relation<OutputFileEntity>;
}

/* ─────────────────────────────────────────────────────────────────
   EPIC-002/003/004: InvoiceRecordEntity
   ───────────────────────────────────────────────────────────────── */
@Entity('invoice_records')
@Index(['batch_id', 'preprocessing_status'])
@Index(['batch_id', 'eda_status'])
@Index(['image_hash'])
export class InvoiceRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  batch_id!: string;

  @ManyToOne(() => InvoiceBatchEntity, batch => batch.records, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batch_id' })
  batch?: Relation<InvoiceBatchEntity>;

  /** v3.1: origin URL from the uploaded CSV manifest */
  @Column({ type: 'text', nullable: false })
  source_url!: string;

  /** v3.1: SHA-256 of downloaded image bytes — enables deduplication */
  @Column({ type: 'varchar', length: 64, nullable: true })
  image_hash!: string | null;

  /** v3.1: number of pages (>1 for multi-page PDFs) */
  @Column({ type: 'int', default: 1 })
  page_count!: number;

  @Column({ type: 'text', nullable: true })
  image_path!: string | null;

  @Column({ type: 'int', nullable: false })
  csv_row_number!: number;

  @Column({ type: 'jsonb', nullable: true })
  raw_csv_data!: Record<string, string> | null;

  @Column({ type: 'jsonb', nullable: true })
  raw_metadata!: Record<string, string> | null;

  @Column({ type: 'varchar', length: 50, default: 'PENDING' })
  preprocessing_status!: string;

  @Column({ type: 'varchar', length: 50, default: 'PENDING' })
  eda_status!: string;

  @Column({ type: 'text', nullable: true })
  error_message!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @OneToOne(() => ExtractionResultEntity, result => result.invoice_record)
  extraction_result?: Relation<ExtractionResultEntity>;
}

/* ─────────────────────────────────────────────────────────────────
   EPIC-002: FileUploadEntity
   ───────────────────────────────────────────────────────────────── */
@Entity('file_uploads')
export class FileUploadEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  batch_id!: string;

  @Column({ type: 'uuid', nullable: true })
  record_id!: string | null;

  @Column({ type: 'varchar', length: 512 })
  file_name!: string;

  @Column({ type: 'varchar', length: 100 })
  file_type!: string;

  @Column({ type: 'bigint' })
  file_size_bytes!: number;

  @Column({ type: 'text' })
  storage_path!: string;

  /** UPLOAD | FETCHED | GENERATED — how the file arrived in the system */
  @Column({ type: 'varchar', length: 20, default: 'UPLOAD' })
  source!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  uploaded_at!: Date;
}

/* ─────────────────────────────────────────────────────────────────
   EPIC-003/005/006: ProcessingStatusEntity
   ───────────────────────────────────────────────────────────────── */
@Entity('processing_status')
export class ProcessingStatusEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  batch_id!: string;

  @OneToOne(() => InvoiceBatchEntity)
  @JoinColumn({ name: 'batch_id' })
  batch?: Relation<InvoiceBatchEntity>;

  @Column({ type: 'varchar', length: 50, default: 'PENDING' })
  preprocessing_status!: string;

  @Column({ type: 'timestamptz', nullable: true })
  preprocessing_start!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  preprocessing_end!: Date | null;

  @Column({ type: 'int', nullable: true })
  preprocessing_duration_s!: number | null;

  @Column({ type: 'varchar', length: 50, default: 'PENDING' })
  eda_status!: string;

  @Column({ type: 'timestamptz', nullable: true })
  eda_start!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  eda_end!: Date | null;

  @Column({ type: 'int', nullable: true })
  eda_duration_s!: number | null;

  @Column({ type: 'int', default: 0 })
  total_records!: number;

  @Column({ type: 'int', default: 0 })
  processed_records!: number;

  @Column({ type: 'int', default: 0 })
  error_records!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  avg_confidence!: string | null;

  @Column({ type: 'int', nullable: true })
  turnaround_time_s!: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}

/* ─────────────────────────────────────────────────────────────────
   EPIC-003: AuditLogEntity
   ───────────────────────────────────────────────────────────────── */
@Entity('audit_logs')
@Index(['batch_id', 'created_at'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  batch_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  record_id!: string | null;

  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Column({ type: 'varchar', length: 255 })
  actor!: string;

  @Column({ type: 'jsonb', nullable: true })
  payload!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}

/* ─────────────────────────────────────────────────────────────────
   EPIC-004: ExtractionResultEntity
   ───────────────────────────────────────────────────────────────── */
@Entity('extraction_results')
export class ExtractionResultEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  invoice_record_id!: string;

  @OneToOne(() => InvoiceRecordEntity)
  @JoinColumn({ name: 'invoice_record_id' })
  invoice_record?: Relation<InvoiceRecordEntity>;

  @Column({ type: 'varchar', length: 200, nullable: true }) dealer_name!: string | null;
  @Column({ type: 'varchar', length: 200, nullable: true }) customer_name!: string | null;
  @Column({ type: 'varchar', length: 20,  nullable: true }) customer_mobile!: string | null;
  @Column({ type: 'varchar', length: 20,  nullable: true }) vehicle_registration_number!: string | null;
  @Column({ type: 'varchar', length: 50,  nullable: true }) tyre_size!: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) tyre_pattern!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  invoice_amount_excl_gst!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  gst_amount!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  gst_components!: Record<string, number> | null;

  @Column({ type: 'int', nullable: true })       quantity!: number | null;
  @Column({ type: 'date', nullable: true })      invoice_date!: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) invoice_number!: string | null;
  @Column({ type: 'text', nullable: true })      comments!: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  confidence_score!: string | null;

  @Column({ type: 'varchar', length: 100, default: 'unknown' })
  llm_provider_used!: string;

  @Column({ type: 'varchar', length: 50, default: 'PENDING' })
  extraction_status!: string;

  @Column({ type: 'jsonb', nullable: true })
  raw_llm_response!: Record<string, unknown> | null;

  /** v3.1: OCR text corroboration signal (used for scorer bonuses) */
  @Column({ type: 'text', nullable: true })
  ocr_text!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  extracted_at!: Date;
}

/* ─────────────────────────────────────────────────────────────────
   EPIC-004: OutputFileEntity
   ───────────────────────────────────────────────────────────────── */
@Entity('output_files')
export class OutputFileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  batch_id!: string;

  @OneToOne(() => InvoiceBatchEntity)
  @JoinColumn({ name: 'batch_id' })
  batch?: Relation<InvoiceBatchEntity>;

  @Column({ type: 'text' })
  file_path!: string;

  @Column({ type: 'int', default: 0 })
  record_count!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  generated_at!: Date;
}

/* ─────────────────────────────────────────────────────────────────
   EPIC-007: ReportFileEntity
   ───────────────────────────────────────────────────────────────── */
@Entity('report_files')
@Index(['report_type', 'generated_at'])
export class ReportFileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  report_type!: string;

  @Column({ type: 'jsonb' })
  parameters!: Record<string, string>;

  @Column({ type: 'text' })
  file_path!: string;

  @Column({ type: 'varchar', length: 20, default: 'CSV' })
  file_format!: string;

  @Column({ type: 'int', default: 0 })
  record_count!: number;

  @Column({ type: 'uuid' })
  generated_by_user_id!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  generated_at!: Date;
}

/* ─────────────────────────────────────────────────────────────────
   v3.1 (new): DeadLetterRecordEntity
   ───────────────────────────────────────────────────────────────── */
export type FailureStage = 'FETCH' | 'PDF_CONVERT' | 'OCR' | 'LLM' | 'RULE' | 'OUTPUT';

@Entity('dead_letter_records')
@Index(['batch_id', 'created_at'])
export class DeadLetterRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  batch_id!: string;

  @Column({ type: 'uuid', nullable: true })
  record_id!: string | null;

  @Column({ type: 'varchar', length: 50 })
  failure_stage!: FailureStage;

  @Column({ type: 'varchar', length: 100, nullable: true })
  error_code!: string | null;

  @Column({ type: 'text', nullable: true })
  error_message!: string | null;

  @Column({ type: 'int', default: 1 })
  attempts!: number;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  last_attempt_at!: Date;

  @Column({ type: 'boolean', default: true })
  retry_eligible!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  retried_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolved_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
