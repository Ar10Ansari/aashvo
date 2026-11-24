import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { CloudStorageAdapter } from './adapters/cloud-storage.adapter';
import { LocalStorageAdapter } from './adapters/local-storage.adapter';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { STORAGE_PORT } from './ports/storage.port';
import type { AppConfig } from '../../infrastructure/config/env.schema';

@Module({
  imports: [PrismaModule, AuditModule, ConfigModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    LocalStorageAdapter,
    CloudStorageAdapter,
    {
      provide: STORAGE_PORT,
      useFactory: (
        config: ConfigService<AppConfig, true>,
        localAdapter: LocalStorageAdapter,
        cloudAdapter: CloudStorageAdapter,
      ) => {
        const provider = config.get('STORAGE_PROVIDER', { infer: true });
        if (provider === 'cloud') {
          return cloudAdapter;
        }
        return localAdapter;
      },
      inject: [ConfigService, LocalStorageAdapter, CloudStorageAdapter],
    },
  ],
  exports: [MediaService, STORAGE_PORT],
})
export class MediaModule {}
