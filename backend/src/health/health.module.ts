/**
 * @file   health.module.ts
 * @module Health
 * @since 3.1.0
 */

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';

@Module({
  imports: [HttpModule.register({ timeout: 2000 })],
  controllers: [HealthController],
})
export class HealthModule {}
