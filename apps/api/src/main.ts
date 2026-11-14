import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.factory';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const { port, swaggerEnabled } = configureApp(app);

  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(
    `Aashvo API listening on port ${port} (swagger: ${swaggerEnabled ? '/api/docs' : 'disabled'})`,
  );
}

void bootstrap();

