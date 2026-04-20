/**
 * @file   HttpExceptionFilter.ts
 * @module Common
 *
 * @description
 * Global HTTP exception filter. Catches all exceptions thrown in the
 * application and formats them into a consistent JSON error envelope.
 *
 * Envelope: { statusCode, message, error, timestamp, path, requestId }
 *
 * @since 1.0.0
 */

import {
  ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

export interface ErrorEnvelope {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  requestId?: string;
  details?: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request  = ctx.getRequest<Request>();

    const statusCode = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw = exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = this.extractMessage(raw, exception);
    const details = typeof raw === 'object' ? raw : undefined;

    const requestId = (request.headers['x-request-id'] as string | undefined) ?? randomUUID();

    const envelope: ErrorEnvelope = {
      statusCode,
      message,
      error: HttpStatus[statusCode] ?? 'Error',
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
      details,
    };

    if (statusCode >= 500) {
      this.logger.error(
        `${statusCode} ${request.method} ${request.url} — ${message}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${statusCode} ${request.method} ${request.url} — ${message}`);
    }

    response.setHeader('x-request-id', requestId);
    response.status(statusCode).json(envelope);
  }

  private extractMessage(raw: string | object | undefined, fallback: unknown): string {
    if (!raw) return fallback instanceof Error ? fallback.message : 'Internal server error';
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && raw !== null && 'message' in raw) {
      const m = (raw as { message: unknown }).message;
      return Array.isArray(m) ? m.join('; ') : String(m);
    }
    return 'An error occurred';
  }
}
