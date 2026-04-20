/**
 * @file   dashboard.module.ts
 * @module Dashboard (EPIC-006)
 */

import { Module } from '@nestjs/common';
import { DashboardController } from './controller/dashboard.controller';
import { DashboardService } from './service/dashboard.service';
import { DashboardRepository } from './repositories/dashboard.repository';
import { AppLogger } from '../common/logger/AppLogger';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, DashboardRepository, AppLogger],
  exports: [DashboardService],
})
export class DashboardModule {}
