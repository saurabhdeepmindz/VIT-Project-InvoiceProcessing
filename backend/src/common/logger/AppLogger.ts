/**
 * @file   AppLogger.ts
 * @module Common
 *
 * @description
 * Application-wide structured logger built on Winston.
 * Provides INFO, WARN, ERROR, DEBUG and AUDIT levels with consistent
 * JSON / pretty output including module context and correlation fields.
 *
 * EPIC: Cross-cutting — all Epics (EPIC-001 through EPIC-007)
 *
 * @since 1.0.0
 */

import { Injectable, LoggerService, Scope } from '@nestjs/common';
import * as winston from 'winston';

export interface AuditEntry {
  actor: string;
  action: string;
  target: { type: string; id: string };
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

const AUDIT_LEVEL = 'audit';

const CUSTOM_LEVELS = {
  error: 0, warn: 1, audit: 2, info: 3, debug: 4,
};

// Register colours for custom levels (winston's built-in colorize() only knows
// the default npm levels; without this, .audit() crashes with
// "colors[Colorizer.allColors[lookup]] is not a function").
winston.addColors({
  error: 'red',
  warn:  'yellow',
  audit: 'magenta',
  info:  'green',
  debug: 'blue',
});

/**
 * Structured application logger wrapping Winston.
 * Scope.TRANSIENT so each injecting class can keep its own context.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger implements LoggerService {
  private readonly winstonLogger: winston.Logger;
  private context = 'App';

  constructor() {
    const level  = process.env.LOG_LEVEL ?? 'info';
    const pretty = (process.env.LOG_FORMAT ?? 'pretty') === 'pretty';

    const format = pretty
      ? winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
          winston.format.colorize(),
          winston.format.printf(info => {
            const meta = { ...info };
            delete (meta as Record<string, unknown>).level;
            delete (meta as Record<string, unknown>).message;
            delete (meta as Record<string, unknown>).timestamp;
            const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
            return `${info.timestamp} ${info.level} [${this.context}] ${info.message}${metaStr}`;
          }),
        )
      : winston.format.combine(winston.format.timestamp(), winston.format.json());

    const transports: winston.transport[] = [new winston.transports.Console()];
    if (process.env.LOG_FILE_PATH) {
      transports.push(new winston.transports.File({ filename: process.env.LOG_FILE_PATH }));
    }
    if (process.env.AUDIT_LOG_PATH) {
      transports.push(new winston.transports.File({
        filename: process.env.AUDIT_LOG_PATH,
        level: AUDIT_LEVEL,
      }));
    }

    this.winstonLogger = winston.createLogger({
      levels: CUSTOM_LEVELS,
      level, format, transports,
    });
  }

  setContext(context: string): this {
    this.context = context;
    return this;
  }

  log(message: string, meta?: unknown): void {
    this.winstonLogger.info(message, this.normaliseMeta(meta));
  }

  warn(message: string, meta?: unknown): void {
    this.winstonLogger.warn(message, this.normaliseMeta(meta));
  }

  error(message: string, trace?: string, meta?: unknown): void {
    this.winstonLogger.error(message, { ...this.normaliseMeta(meta), trace });
  }

  debug(message: string, meta?: unknown): void {
    if (process.env.NODE_ENV === 'production') return;
    this.winstonLogger.debug(message, this.normaliseMeta(meta));
  }

  /**
   * Winston spreads a raw string into char-indexed keys ({"0":"I","1":"n",...}).
   * NestJS internals call logger.log(msg, contextString) with a 2nd string arg,
   * so we convert non-object metadata into a proper { context } shape.
   */
  private normaliseMeta(meta: unknown): Record<string, unknown> {
    if (meta == null) return { context: this.context };
    if (typeof meta === 'string') return { context: meta || this.context };
    if (typeof meta === 'object') return { context: this.context, ...(meta as Record<string, unknown>) };
    return { context: this.context, value: meta };
  }

  audit(entry: AuditEntry): void {
    this.winstonLogger.log(AUDIT_LEVEL, 'AUDIT', {
      context: this.context,
      ...entry,
      timestamp: new Date().toISOString(),
    });
  }

  verbose(message: string, meta?: Record<string, unknown>): void {
    this.debug(message, meta);
  }
}
