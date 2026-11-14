import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Aashvo Platform API')
    .setDescription(
      'Independent NestJS + PostgreSQL API powering the Aashvo shared-living, flatmates, family stays, and rental trust marketplace.',
    )
    .setVersion('1.0.0')
    .addServer('http://localhost:4000', 'Local Development')
    .addServer('https://api.aashvo.in', 'Production (India)')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Short-lived EdDSA/RS256 access token issued by AuthModule (Sprint 2+).',
      },
      'BearerAuth',
    )
    .build();

  return SwaggerModule.createDocument(app, config);
}

export function mountSwaggerUi(app: INestApplication, document: OpenAPIObject): void {
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}

