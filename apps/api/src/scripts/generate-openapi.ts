import 'reflect-metadata';
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { buildOpenApiDocument } from '../infrastructure/openapi/swagger.setup';

function ensureScriptEnvDefaults(): void {
  const keys = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  process.env.NODE_ENV ??= 'test';
  process.env.DATABASE_URL ??= 'postgresql://postgres:local-only@127.0.0.1:5433/aashvo_dev';
  process.env.JWT_SIGNING_PRIVATE_KEY ??= keys.privateKey;
  process.env.JWT_SIGNING_PUBLIC_KEY ??= keys.publicKey;
  process.env.CORS_ALLOWED_ORIGINS ??= 'http://localhost:5173';
}

async function generateOpenApiSpec(): Promise<void> {
  // Set defaults before loading AppModule because ConfigModule.forRoot validates at import time.
  ensureScriptEnvDefaults();

  const { AppModule } = await import('../app.module');
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  const document = buildOpenApiDocument(app);
  const outputPath = resolve(__dirname, '../../../../packages/contracts/openapi.json');

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  await app.close();
}

generateOpenApiSpec().catch((err: unknown) => {
  console.error('Failed to generate OpenAPI spec:', err);
  process.exit(1);
});
