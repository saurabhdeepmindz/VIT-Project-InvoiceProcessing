/**
 * @file   MetricsInterceptor.ts
 * @module Common
 *
 * @description
 * Basic Prometheus metrics interceptor (v3.1).
 * Counts HTTP requests by method/path/status and records duration.
 *
 * Exposed via GET /metrics — registered in HealthModule.
 *
 * @since 3.1.0
 */

import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { Request, Response } from 'express';

export const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry });

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests processed',
  labelNames: ['method', 'path', 'status'] as const,
  registers: [metricsRegistry],
});

const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (process.env.METRICS_ENABLED === 'false') return next.handle();

    const http = context.switchToHttp();
    const req  = http.getRequest<Request>();
    const res  = http.getResponse<Response>();
    const routePath = (req.route?.path as string) ?? req.path ?? 'unknown';

    const end = httpRequestDurationSeconds.startTimer({ method: req.method, path: routePath });

    return next.handle().pipe(
      tap({
        next:  () => {
          httpRequestsTotal.inc({ method: req.method, path: routePath, status: res.statusCode });
          end();
        },
        error: () => {
          httpRequestsTotal.inc({ method: req.method, path: routePath, status: 500 });
          end();
        },
      }),
    );
  }
}
