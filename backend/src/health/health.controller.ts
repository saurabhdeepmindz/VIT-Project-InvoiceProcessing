/**
 * @file   health.controller.ts
 * @module Health
 *
 * @description
 * Health + readiness + metrics endpoints (v3.1 basic observability).
 *  - GET /health   — liveness (always 200 when app is up)
 *  - GET /ready    — readiness (DB + Python AI reachable)
 *  - GET /metrics  — Prometheus metrics (when METRICS_ENABLED=true)
 *
 * @since 3.1.0
 */

import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { metricsRegistry } from '../common/interceptors/MetricsInterceptor';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly http: HttpService,
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness — returns 200 while the process is up' })
  liveness(): { status: string; service: string; version: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'invoice-processing-backend',
      version: '3.1.0',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness — checks DB + Python AI reachability' })
  async readiness(@Res() res: Response): Promise<Response> {
    const checks: Record<string, { ok: boolean; detail?: string }> = {};

    // DB check
    try {
      await this.dataSource.query('SELECT 1');
      checks.database = { ok: true };
    } catch (err: unknown) {
      checks.database = { ok: false, detail: err instanceof Error ? err.message : String(err) };
    }

    // Python AI check
    const pythonUrl = process.env.PYTHON_AI_SERVICE_URL ?? 'http://localhost:8001';
    const pythonOk  = await firstValueFrom(
      this.http.get(`${pythonUrl}/health`).pipe(
        timeout(2000),
        catchError(() => of(null)),
      ),
    );
    checks.python_ai = pythonOk ? { ok: true } : { ok: false, detail: 'unreachable' };

    const allOk = Object.values(checks).every(c => c.ok);
    return res
      .status(allOk ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
      .json({ status: allOk ? 'ready' : 'degraded', checks, timestamp: new Date().toISOString() });
  }

  @Public()
  @Get('metrics')
  @ApiOperation({ summary: 'Prometheus metrics' })
  async metrics(@Res() res: Response): Promise<Response> {
    if (process.env.METRICS_ENABLED === 'false') {
      return res.status(HttpStatus.NOT_FOUND).send('metrics disabled');
    }
    res.setHeader('Content-Type', metricsRegistry.contentType);
    return res.send(await metricsRegistry.metrics());
  }
}
