/**
 * @file   main.ts
 * @module Bootstrap
 *
 * @description
 * Bootstrap entry point for the NestJS backend.
 * Configures global pipes, filters, interceptors, Swagger, Helmet,
 * and starts listening on APP_PORT.
 *
 * @since 1.0.0
 */

import 'reflect-metadata';
import { NestFactory }         from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet                  from 'helmet';
import { AppModule }           from './app.module';
import { AppLogger }           from './common/logger/AppLogger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // AppLogger is TRANSIENT-scoped so each consumer gets its own setContext state.
  // That means main.ts must use resolve() (async) instead of get() here.
  const logger = (await app.resolve(AppLogger)).setContext('Bootstrap');
  app.useLogger(logger);

  // Security headers
  app.use(helmet());

  // CORS — frontend origin
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  app.enableCors({ origin: frontendUrl, credentials: true });

  // API versioning prefix
  const apiPrefix = process.env.API_PREFIX ?? '/api/v1';
  app.setGlobalPrefix(apiPrefix, { exclude: ['/health', '/ready', '/metrics'] });

  // Swagger / OpenAPI
  if (process.env.SWAGGER_ENABLED !== 'false') {
    const config = new DocumentBuilder()
      .setTitle('Invoice Processing Platform API')
      .setDescription('Bridgestone Invoice Processing — REST API (v3.1)')
      .setVersion('3.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = Number(process.env.APP_PORT ?? 3001);
  await app.listen(port);

  logger.log(`Invoice Processing backend listening on port ${port}`, {
    apiPrefix, frontendUrl, node: process.version,
  });
}

bootstrap().catch(err => {

  console.error('Failed to bootstrap application:', err);
  process.exit(1);
});
