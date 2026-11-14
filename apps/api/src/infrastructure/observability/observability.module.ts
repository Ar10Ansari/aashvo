import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { AppConfig } from '../config/env.schema';
import { buildPinoParams } from './logger.config';

@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) =>
        buildPinoParams({
          environment: configService.get('NODE_ENV', { infer: true }),
          logLevel: configService.get('LOG_LEVEL', { infer: true }),
        }),
    }),
  ],
  exports: [LoggerModule],
})
export class ObservabilityModule {}

