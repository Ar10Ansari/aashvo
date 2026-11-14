import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import type { AppConfig } from './infrastructure/config/env.schema';
import { buildOpenApiDocument, mountSwaggerUi } from './infrastructure/openapi/swagger.setup';

/**
 * Applies production security middleware, strict DTO validation, CORS allowlisting,
 * and optional Swagger UI consistently across runtime and integration tests.
 */
export function configureApp(app: INestApplication): { port: number; swaggerEnabled: boolean } {
  const configService = app.get<ConfigService<AppConfig, true>>(ConfigService);
  const environment = configService.get('NODE_ENV', { infer: true });
  const allowedOrigins = configService.get('CORS_ALLOWED_ORIGINS', { infer: true });
  const trustProxy = configService.get('TRUST_PROXY', { infer: true });
  const port = configService.get('PORT', { infer: true });
  const explicitSwagger = configService.get('ENABLE_SWAGGER', { infer: true });
  const swaggerEnabled =
    explicitSwagger !== undefined ? explicitSwagger : environment !== 'production';

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  const expressApp = app as NestExpressApplication;
  expressApp.set('trust proxy', trustProxy);
  expressApp.disable('x-powered-by');

  app.use(
    helmet({
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use(cookieParser());

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'Idempotency-Key', 'X-Client-Platform'],
    exposedHeaders: ['X-Request-ID'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (swaggerEnabled && environment !== 'test') {
    const document = buildOpenApiDocument(app);
    mountSwaggerUi(app, document);
  }

  return { port, swaggerEnabled };
}
