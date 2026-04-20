/**
 * @file   database.module.ts
 * @module Database
 *
 * @description
 * Global TypeORM module configured from environment variables.
 * Provides the DataSource to all EPIC modules via @nestjs/typeorm.
 *
 * @since 1.0.0
 */

import { Module }         from '@nestjs/common';
import { TypeOrmModule }  from '@nestjs/typeorm';
import { ConfigService }  from '@nestjs/config';
import { buildDataSourceOptions } from './data-source';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (): ReturnType<typeof buildDataSourceOptions> => buildDataSourceOptions(),
    }),
  ],
})
export class DatabaseModule {}
