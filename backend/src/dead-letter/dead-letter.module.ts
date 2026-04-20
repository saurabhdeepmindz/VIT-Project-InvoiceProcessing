/**
 * @file   dead-letter.module.ts
 * @module DeadLetter (global, v3.1)
 */

import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeadLetterRecordEntity } from '../entities/Entities';
import { DeadLetterRepository } from './dead-letter.repository';
import { DeadLetterService } from './dead-letter.service';
import { AppLogger } from '../common/logger/AppLogger';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([DeadLetterRecordEntity])],
  providers: [DeadLetterRepository, DeadLetterService, AppLogger],
  exports: [DeadLetterService, DeadLetterRepository],
})
export class DeadLetterModule {}
