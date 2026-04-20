/**
 * @file   tracker.module.ts
 * @module Tracker (EPIC-005)
 */

import { Module } from '@nestjs/common';
import { PreprocessingModule } from '../preprocessing/preprocessing.module';

import { TrackerController } from './controller/tracker.controller';
import { TrackerService } from './service/tracker.service';
import { TrackerRepository } from './repositories/tracker.repository';
import { AppLogger } from '../common/logger/AppLogger';

@Module({
  imports: [PreprocessingModule],              // re-uses AuditLogRepository
  controllers: [TrackerController],
  providers: [TrackerService, TrackerRepository, AppLogger],
  exports: [TrackerService],
})
export class TrackerModule {}
