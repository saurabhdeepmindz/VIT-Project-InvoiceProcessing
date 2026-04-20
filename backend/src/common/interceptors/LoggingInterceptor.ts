/**
 * @file   LoggingInterceptor.ts
 * @module Common
 *
 * @description
 * Global request/response interceptor.
 * Logs method, path, status, duration, userId, batchId, requestId.
 *
 * @since 1.0.0
 */

import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';

interface RequestWithUser extends Request {
  user?: { id?: string; email?: string; role?: string };
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request  = http.getRequest<RequestWithUser>();
    const response = http.getResponse<Response>();

    const { method, url, body, params } = request;
    const userId    = request.user?.id ?? 'anonymous';
    const batchId   = params?.batchId ?? (body as Record<string, unknown>)?.batchId ?? '-';
    const requestId = (request.headers['x-request-id'] as string | undefined) ?? randomUUID();
    response.setHeader('x-request-id', requestId);

    const start = Date.now();
    this.logger.log(`→ ${method} ${url}`, { userId, batchId, requestId });

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        this.logger.log(`← ${method} ${url} ${response.statusCode} ${duration}ms`, {
          userId, batchId, requestId, duration,
        });
      }),
      catchError(err => {
        const duration = Date.now() - start;
        this.logger.error(`✗ ${method} ${url} — ${err?.message ?? 'error'}`, undefined, {
          userId, batchId, requestId, duration,
        } as unknown as string);
        return throwError(() => err);
      }),
    );
  }
}
